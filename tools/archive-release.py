"""Create or read-only verify exact Git-source and production release archives.

Archives are written only into a new output directory. Verification streams every
ZIP entry (including its CRC), then independently compares the source with a fresh
Git TAR export so checkout line endings and .gitattributes are handled correctly.
This tool never extracts, deletes, deploys, changes Git, or reads credentials.
"""
import argparse
import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tarfile
from urllib.parse import unquote, urlsplit
import zipfile

CHUNK = 2 * 1024 * 1024
SCHEMA = "bastions-release-archive-v1"
DEFAULT_REPO = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest_stream(stream):
    digest, size = hashlib.sha256(), 0
    while block := stream.read(CHUNK):
        digest.update(block)
        size += len(block)
    return {"bytes": size, "sha256": digest.hexdigest()}


def digest_file(path):
    with path.open("rb") as stream:
        return digest_stream(stream)


def safe_name(name, directory=False):
    require(isinstance(name, str) and name and not any(ord(c) < 32 for c in name), "Invalid archive path")
    require("\\" not in name and ":" not in name, f"Nonportable archive path: {name}")
    canonical = name[:-1] if directory and name.endswith("/") else name
    parts = canonical.split("/")
    require(not PurePosixPath(canonical).is_absolute() and all(p not in ("", ".", "..") for p in parts), f"Unsafe archive path: {name}")
    require(all(not p.endswith((".", " ")) for p in parts), f"Nonportable archive path: {name}")
    return canonical


def validate_names(entries):
    seen, files = set(), set()
    for name, directory in entries:
        canonical = safe_name(name, directory).casefold()
        require(canonical not in seen, f"Duplicate or case-colliding archive path: {name}")
        seen.add(canonical)
        if not directory:
            files.add(canonical)
    for name in seen:
        parts = name.split("/")
        require(not any("/".join(parts[:i]) in files for i in range(1, len(parts))), f"File/directory archive path collision: {name}")


def zip_inventory(path):
    rows = []
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        # ZipInfo normalizes Windows backslashes and truncates NULs in filename;
        # validate the original central-directory spelling before trusting it.
        validate_names((entry.orig_filename, entry.is_dir()) for entry in members)
        require(all(entry.orig_filename == entry.filename for entry in members), "ZIP filename was normalized while reading")
        for entry in members:
            mode = stat.S_IFMT(entry.external_attr >> 16)
            require(mode in (0, stat.S_IFDIR if entry.is_dir() else stat.S_IFREG), f"Unsupported ZIP entry type: {entry.filename}")
            require(not entry.flag_bits & 1, f"Encrypted ZIP entry: {entry.filename}")
            # Reading to EOF makes zipfile check each compressed stream's CRC.
            with archive.open(entry) as stream:
                record = digest_stream(stream)
            require(record["bytes"] == entry.file_size, f"ZIP entry length differs: {entry.filename}")
            if not entry.is_dir():
                rows.append({"file": entry.filename, **record})
            else:
                require(record["bytes"] == 0, f"Directory contains ZIP payload: {entry.filename}")
    return sorted(rows, key=lambda row: row["file"])


def read_json_entry(path, name):
    with zipfile.ZipFile(path) as archive:
        require(archive.getinfo(name).file_size <= 2 * 1024 * 1024, f"Release metadata is too large: {name}")
        return json.loads(archive.read(name).decode("utf-8-sig"))


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE)


def checked_commit(repo, commit):
    require(re.fullmatch(r"[0-9a-f]{40}", commit or ""), "Commit must be a full lowercase 40-character Git commit SHA")
    actual = git(repo, "rev-parse", "--verify", commit + "^{commit}").decode().strip()
    require(actual == commit, "Commit does not resolve to the exact requested commit")
    return actual


def commit_version(repo, commit):
    package = json.loads(git(repo, "show", f"{commit}:package.json"))
    version = package.get("version")
    require(isinstance(version, str) and re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,3}", version), "Release version must use x.y.z")
    release = json.loads(git(repo, "show", f"{commit}:public/release.json"))
    require(release.get("version") == version, "Committed package and public release versions differ")
    source = git(repo, "show", f"{commit}:game/release.js").decode("utf-8-sig")
    match = re.search(r"export\s+const\s+GAME_VERSION\s*=\s*(['\"])([^'\"]+)\1", source)
    require(match and match.group(2) == version, "Committed GAME_VERSION differs")
    return version


def compare_git_tar(repo, commit, expected):
    by_name = {row["file"]: row for row in expected}
    process = subprocess.Popen(["git", "-C", str(repo), "archive", "--format=tar", commit], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    seen, names = set(), []
    try:
        with tarfile.open(fileobj=process.stdout, mode="r|") as archive:
            for entry in archive:
                names.append((entry.name, entry.isdir()))
                require(entry.isdir() or entry.isfile(), f"Unsupported Git export entry: {entry.name}")
                if entry.isdir():
                    continue
                safe_name(entry.name)
                require(entry.name not in seen and entry.name in by_name, f"Fresh Git TAR has unexpected entry: {entry.name}")
                seen.add(entry.name)
                with archive.extractfile(entry) as stream:
                    actual = digest_stream(stream)
                require(actual == {key: by_name[entry.name][key] for key in ("bytes", "sha256")}, f"Fresh Git TAR differs from source ZIP: {entry.name}")
        validate_names(names)
        require(process.wait() == 0, "Fresh Git TAR export failed")
        require(seen == by_name.keys(), "Source ZIP has files absent from fresh Git TAR")
    finally:
        if process.poll() is None:
            process.kill()
        process.communicate()


def base_path(value):
    require(isinstance(value, str) and value.startswith("/") and value.endswith("/"), "Production base must start and end with /")
    require(not any(c in value for c in "\\?#%") and (value == "/" or all(p not in ("", ".", "..") for p in value[1:-1].split("/"))), "Invalid production base")
    return value


class EntryAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls, self.modules = [], 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and "src" in attrs:
            self.urls.append(attrs["src"])
            self.modules += attrs.get("type") == "module"
        if tag == "link" and attrs.get("rel") in ("stylesheet", "modulepreload"):
            self.urls.append(attrs.get("href", ""))


def check_production(archive_path, version, base, files):
    by_name = {row["file"] for row in files}
    require({"index.html", "archer.html", "release.json"} <= by_name, "Production entry points or release.json are missing")
    require(read_json_entry(archive_path, "release.json").get("version") == version, "Production release version differs from committed source")
    with zipfile.ZipFile(archive_path) as archive:
        for name in ("index.html", "archer.html"):
            require(archive.getinfo(name).file_size <= 2 * 1024 * 1024, f"Production HTML is too large: {name}")
            parser = EntryAssets()
            parser.feed(archive.read(name).decode("utf-8-sig"))
            require(parser.modules > 0, f"Production module entry missing: {name}")
            for url in parser.urls:
                parsed = urlsplit(url)
                require(not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment and parsed.path.startswith(base), f"Production URL has incorrect base {base}: {url}")
                relative = unquote(parsed.path[len(base):])
                safe_name(relative)
                require(relative in by_name, f"Production HTML references missing asset: {relative}")


def dist_inventory(dist):
    require(dist.is_dir(), "Production directory does not exist")
    rows, names = [], []
    for path in sorted(dist.rglob("*")):
        require(not path.is_symlink() and not getattr(path, "is_junction", lambda: False)(), f"Production links are not supported: {path}")
        require(path.resolve().is_relative_to(dist), f"Production path escapes directory: {path}")
        name = path.relative_to(dist).as_posix()
        is_directory = path.is_dir()
        names.append((name, is_directory))
        if not is_directory:
            require(stat.S_ISREG(path.stat().st_mode), f"Unsupported production file: {path}")
            rows.append({"file": name, **digest_file(path)})
    validate_names(names)
    require(rows, "Production directory is empty")
    return sorted(rows, key=lambda row: row["file"])


def archive_record(path, files):
    return {"file": path.name, **digest_file(path), "fileCount": len(files), "totalBytes": sum(row["bytes"] for row in files), "files": files}


def validate_record(record, expected_name):
    require(isinstance(record, dict) and record.get("file") == expected_name, "Manifest archive filename differs")
    require(isinstance(record.get("files"), list), "Manifest file inventory is missing")
    for row in record["files"]:
        require(isinstance(row, dict) and set(row) == {"file", "bytes", "sha256"}, "Invalid manifest inventory row")
        safe_name(row["file"])
        require(type(row["bytes"]) is int and row["bytes"] >= 0 and isinstance(row["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", row["sha256"]), "Invalid manifest inventory digest")
    validate_names((row["file"], False) for row in record["files"])
    require(record.get("fileCount") == len(record["files"]) and record.get("totalBytes") == sum(row["bytes"] for row in record["files"]), "Manifest inventory totals differ")


def create(args):
    repo, dist, output = args.repo.resolve(strict=True), args.dist.resolve(strict=True), args.outputdir.resolve()
    commit = checked_commit(repo, args.commit)
    version, base = commit_version(repo, commit), base_path(args.base)
    require(not output.exists(), "Output directory must be new; existing archives are never overwritten")
    require(output.parent.is_dir(), "Output parent must already exist")
    require(not output.is_relative_to(dist), "Output directory cannot be inside the production directory")
    expected_dist = dist_inventory(dist)
    output.mkdir()
    source = output / f"bastions-v{version}-source.zip"
    production = output / f"bastions-v{version}-production.zip"
    git(repo, "archive", "--format=zip", "--output=" + str(source), commit)
    source_files = zip_inventory(source)
    compare_git_tar(repo, commit, source_files)
    require(read_json_entry(source, "package.json").get("version") == version, "Source ZIP package version differs")
    with zipfile.ZipFile(production, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for row in expected_dist:
            archive.write(dist / row["file"], row["file"])
    production_files = zip_inventory(production)
    require(production_files == expected_dist and dist_inventory(dist) == expected_dist, "Production files changed while archiving")
    check_production(production, version, base, production_files)
    lock = next((row["sha256"] for row in source_files if row["file"] == "pnpm-lock.yaml"), None)
    require(lock, "Committed dependency lockfile is missing")
    manifest = {"schema": SCHEMA, "version": version, "gitCommit": commit, "createdAtUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(), "productionBasePath": base, "dependencyLockSha256": lock, "sourceBytesAuthority": "Exact Git archive export, independently compared with a fresh Git TAR including .gitattributes conversions", "sourceArchive": archive_record(source, source_files), "productionArchive": archive_record(production, production_files)}
    with (output / "manifest.json").open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, indent=2)
        stream.write("\n")
    return manifest


def verify(args):
    output, repo = args.outputdir.resolve(strict=True), args.repo.resolve(strict=True)
    manifest_path = output / "manifest.json"
    require(not manifest_path.is_symlink() and manifest_path.stat().st_size <= 64 * 1024 * 1024, "Manifest is a link or too large")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest.get("schema") == SCHEMA, "Unsupported archive manifest schema")
    commit = checked_commit(repo, manifest.get("gitCommit"))
    require(args.commit is None or args.commit == commit, "Requested commit differs from archive manifest")
    version = commit_version(repo, commit)
    require(manifest.get("version") == version, "Manifest version differs from committed source")
    base = base_path(manifest.get("productionBasePath"))
    records = {}
    for key, kind in (("sourceArchive", "source"), ("productionArchive", "production")):
        record = manifest.get(key)
        validate_record(record, f"bastions-v{version}-{kind}.zip")
        path = output / record["file"]
        require(not path.is_symlink() and path.is_file(), "Archive file is missing or a symbolic link")
        files = zip_inventory(path)
        require(archive_record(path, files) == record, f"Archive bytes or inventory differ from manifest: {kind}")
        records[kind] = files
    compare_git_tar(repo, commit, records["source"])
    source_lock = next((row["sha256"] for row in records["source"] if row["file"] == "pnpm-lock.yaml"), None)
    require(source_lock and manifest.get("dependencyLockSha256") == source_lock, "Manifest dependency lock digest differs")
    check_production(output / manifest["productionArchive"]["file"], version, base, records["production"])
    if args.dist is not None:
        require(dist_inventory(args.dist.resolve(strict=True)) == records["production"], "Production archive differs from supplied dist directory")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("create", "verify"):
        command = commands.add_parser(name)
        command.add_argument("--repo", type=Path, default=DEFAULT_REPO)
        command.add_argument("--commit", required=name == "create")
        command.add_argument("--dist", type=Path, required=name == "create")
        command.add_argument("--outputdir", type=Path, required=True)
        if name == "create":
            command.add_argument("--base", default="/", help="Vite production base; / for offline builds")
    args = parser.parse_args()
    try:
        manifest = create(args) if args.command == "create" else verify(args)
        print(json.dumps({"status": "passed", "command": args.command, "version": manifest["version"], "gitCommit": manifest["gitCommit"], "productionBasePath": manifest["productionBasePath"], "sourceArchive": {k: v for k, v in manifest["sourceArchive"].items() if k != "files"}, "productionArchive": {k: v for k, v in manifest["productionArchive"].items() if k != "files"}, "allZipStreamsCrcAndSha256Verified": True, "sourceMatchesFreshGitTar": True, "extractionPerformed": False, "manifestWritten": args.command == "create"}))
        return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError, zipfile.BadZipFile, tarfile.TarError, subprocess.SubprocessError) as error:
        print(f"Archive {args.command} failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

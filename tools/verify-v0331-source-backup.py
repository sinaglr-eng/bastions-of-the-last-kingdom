"""Verify every offline source-ZIP entry against the immutable stable Git tree."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import zipfile

EXPECTED = "c01ac5a2ab1ef62e77d2ce545f24234b80b5c847"
TAG = "v0.3.31-stable"
ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser()
parser.add_argument("archive", type=Path)
parser.add_argument("--proof", type=Path, required=True)
args = parser.parse_args()
commit = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", f"{TAG}^{{commit}}"], text=True).strip()
assert commit == EXPECTED, "Stable tag no longer resolves to the expected published release"
tree = subprocess.check_output(["git", "-C", str(ROOT), "ls-tree", "-r", "-z", EXPECTED])
expected = {}
for entry in tree.split(b"\0"):
    if not entry:
        continue
    metadata, name = entry.split(b"\t", 1)
    mode, kind, oid = metadata.split()
    assert kind == b"blob", f"Unsupported tree object: {name!r}"
    expected[name.decode("utf-8")] = oid.decode("ascii")
files, seen, total = [], set(), 0
with zipfile.ZipFile(args.archive) as archive:
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        name = entry.filename
        assert name not in seen, f"Duplicate ZIP entry: {name}"
        assert name in expected, f"Unexpected ZIP entry: {name}"
        seen.add(name)
        digest = hashlib.sha256()
        blob = hashlib.sha1(f"blob {entry.file_size}\0".encode("ascii"))
        count = 0
        with archive.open(entry) as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                blob.update(chunk)
                count += len(chunk)
        assert count == entry.file_size, f"Incorrect entry length: {name}"
        files.append({"file": name, "bytes": count, "sha256": digest.hexdigest(), "gitBlob": expected[name],
                      "rawGitBlobMatches": blob.hexdigest() == expected[name]})
        total += count
assert seen == expected.keys(), f"Missing source entries: {expected.keys() - seen}"
# Git archive applies the stable tree's attributes, including *.cmd eol=crlf.
# Independently stream a fresh stable TAR export and compare every exported
# byte hash rather than incorrectly treating expected checkout line endings
# as source corruption. Neither archive is extracted to the workspace.
by_name = {row["file"]: row for row in files}
exported = set()
process = subprocess.Popen(["git", "-C", str(ROOT), "archive", "--format=tar", EXPECTED], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout, mode="r|") as export:
    for entry in export:
        if not entry.isfile() and not entry.issym():
            continue
        assert entry.name in by_name, f"Export missing from source ZIP: {entry.name}"
        digest = hashlib.sha256()
        if entry.issym():
            content = entry.linkname.encode("utf-8")
            digest.update(content)
            size = len(content)
        else:
            size = 0
            stream = export.extractfile(entry)
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                size += len(chunk)
        assert digest.hexdigest() == by_name[entry.name]["sha256"] and size == by_name[entry.name]["bytes"], f"Stable export bytes differ: {entry.name}"
        exported.add(entry.name)
assert process.wait() == 0, process.stderr.read().decode("utf-8", errors="replace")
assert exported == seen, f"ZIP contains entries absent from stable export: {seen - exported}"
archive_hash = hashlib.sha256()
with args.archive.open("rb") as stream:
    while chunk := stream.read(1024 * 1024):
        archive_hash.update(chunk)
proof = {"status": "passed", "version": "0.3.31", "stableTag": TAG, "sourceCommit": EXPECTED,
         "archive": str(args.archive.resolve()), "archiveBytes": args.archive.stat().st_size,
         "archiveSha256": archive_hash.hexdigest(), "fileCount": len(files), "totalBytes": total,
         "allEntriesMatchStableGitArchiveExport": True, "archiveReadCrcChecksPassed": True,
         "attributeConvertedEntries": [row["file"] for row in files if not row["rawGitBlobMatches"]],
         "attributeExplanation": "Stable .gitattributes sets *.cmd text eol=crlf; Git archive export bytes are checked directly through a fresh TAR stream, including attributes. Binary source blobs retain exact bytes.",
         "files": sorted(files, key=lambda row: row["file"])}
args.proof.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in proof.items() if key != "files"}))

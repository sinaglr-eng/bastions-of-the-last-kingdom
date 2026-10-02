"""Measure real native renders against the approved raster turnarounds.

This is an image-analysis/reporting tool, not a model or image-design generator.
It preserves the PNG references, accepts partial pilot output, and reports real
segmentation uncertainty.  Registration permits only translation and ONE
uniform scale; it does not optimise silhouettes, deform pixels, or alter models.
"""

from __future__ import annotations

import argparse
from collections import deque
import csv
import html
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


FAMILIES = ['soldier', 'archer', 'druid', 'mage', 'cleric', 'runebreaker',
            'frostwarden', 'stormcaller']
VIEWS = ['front', 'back', 'left', 'right']
ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']
VISUAL_ID = {'runebreaker': 'engineer'}

# Explicit source-pixel layout readings; these are not model fitting variables.
# Last y in each row is a ceiling for floor/shadow removal, not an invented
# anatomical landmark. Actual foreground soles are detected at or above it.
LAYOUT = {
    'soldier': {'x': [48, 273, 492, 711, 914],
                'y': [82, 337, 594, 857, 1115, 1372, 1650],
                'floor': [328, 587, 847, 1106, 1365, 1639]},
    'archer': {'x': [47, 274, 494, 714, 932],
               'y': [75, 320, 570, 826, 1086, 1348, 1641],
               'floor': [319, 569, 823, 1085, 1346, 1628]},
    'druid': {'x': [46, 273, 493, 713, 927],
              'y': [88, 335, 588, 844, 1103, 1363, 1650],
              'floor': [334, 587, 843, 1102, 1362, 1635]},
    'mage': {'x': [48, 273, 492, 711, 914],
             'y': [82, 337, 594, 857, 1115, 1372, 1650],
             'floor': [327, 583, 846, 1106, 1361, 1638]},
    'cleric': {'x': [61, 273, 493, 713, 914],
               'y': [78, 335, 596, 866, 1129, 1394, 1655],
               'floor': [326, 590, 856, 1121, 1388, 1651]},
    'engineer': {'x': [47, 273, 493, 713, 914],
                 'y': [92, 333, 580, 829, 1082, 1329, 1622],
                 'floor': [322, 569, 817, 1071, 1322, 1614]},
    'frostwarden': {'x': [45, 273, 493, 713, 914],
                    'y': [81, 339, 591, 842, 1101, 1358, 1650],
                    'floor': [328, 580, 831, 1086, 1349, 1639]},
    'stormcaller': {'x': [48, 273, 493, 713, 914],
                    'y': [78, 337, 595, 858, 1119, 1380, 1650],
                    'floor': [327, 590, 854, 1113, 1373, 1640]},
}

FONT = ImageFont.load_default(size=13)
SMALL = ImageFont.load_default(size=11)


def binary_image(mask):
    return Image.fromarray(mask.astype(np.uint8)*255, 'L')


def erode(mask, radius=1):
    return np.asarray(binary_image(mask).filter(
        ImageFilter.MinFilter(radius*2+1))) > 127


def dilate(mask, radius=1):
    return np.asarray(binary_image(mask).filter(
        ImageFilter.MaxFilter(radius*2+1))) > 127


def closing(mask):
    return erode(dilate(mask))


def components(mask):
    """4-connected actual pixel labels; no inferred foreground is added."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    result = []
    lab = 0
    for y, x in zip(*np.nonzero(mask)):
        if labels[y, x]:
            continue
        lab += 1
        labels[y, x] = lab
        q = deque([(int(x), int(y))])
        count = 0
        xmin = xmax = int(x)
        ymin = ymax = int(y)
        while q:
            xx, yy = q.popleft()
            count += 1
            xmin = min(xmin, xx)
            xmax = max(xmax, xx)
            ymin = min(ymin, yy)
            ymax = max(ymax, yy)
            for nx, ny in ((xx-1, yy), (xx+1, yy), (xx, yy-1), (xx, yy+1)):
                if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = lab
                    q.append((nx, ny))
        result.append({'label': lab, 'area': count,
                       'bbox': [xmin, ymin, xmax+1, ymax+1]})
    return labels, sorted(result, key=lambda c: c['area'], reverse=True)


def bounding_box(mask):
    yy, xx = np.nonzero(mask)
    if not len(xx):
        return None
    return [int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1]


def grid_positions(rgb):
    lum = rgb.mean(axis=2)
    rows = np.median(lum[:, 44:930], axis=1)
    cols = np.median(lum[78:1655], axis=0)

    def thin_dips(a):
        mid = (np.roll(a, 3)+np.roll(a, -3))/2
        hits = np.flatnonzero((mid-a > .013) & (a > .60))
        return set(int(i) for i in hits)

    return thin_dips(rows), thin_dips(cols)


def reference_mask(crop, family, rank, floor, global_grid, origin,
                   variant='nominal'):
    rgb = np.asarray(crop.convert('RGB'), dtype=np.float32)/255
    h, w = rgb.shape[:2]
    # Estimate local background from actual outer pixel strips per scanline.
    margins = np.concatenate((rgb[:, :8], rgb[:, -8:]), axis=1)
    bg = np.median(margins, axis=1)[:, None, :]
    maxc, minc = rgb.max(axis=2), rgb.min(axis=2)
    sat = (maxc-minc)/np.maximum(maxc, .001)
    dark = bg.mean(axis=2)-rgb.mean(axis=2)
    distance = np.sqrt(np.sum((rgb-bg)**2, axis=2))
    thresholds = {'strict': (.082, .175, .09),
                  'nominal': (.060, .150, .07),
                  'loose': (.044, .125, .05)}
    d, s, shade = thresholds[variant]
    mask = (((distance > d) & (dark > .014)) |
            ((sat > s) & (maxc < .985)) |
            (dark > shade))
    # Grid pixels are identified from observed thin-dip scanlines, not erased
    # across the object. Similar-coloured object pixels are a stated uncertainty.
    grid_y, grid_x = global_grid
    x0, y0 = origin
    for yy in range(h):
        if yy+y0 in grid_y:
            line = np.median(np.concatenate((rgb[yy, :12], rgb[yy, -12:])), axis=0)
            mask[yy] &= np.sqrt(np.sum((rgb[yy]-line)**2, axis=1)) > .034
    for xx in range(w):
        if xx+x0 in grid_x:
            line = np.median(rgb[:, xx], axis=0)
            mask[:, xx] &= np.sqrt(np.sum((rgb[:, xx]-line)**2, axis=1)) > .034
    mask[max(0, min(h, floor+1)):] = False
    # Neutral light pixels immediately at the foot line are reference ground
    # guides/contact shadows. Dark soles and saturated brown boots survive.
    neutral_ground = (sat < .09) & (rgb.mean(axis=2) > .62)
    neutral_ground[:max(0, floor-4)] = False
    mask &= ~neutral_ground
    # VI has nonphysical gold rings with white antialiased fringes, so remove
    # thin bright structures across colours. Re-add real dark/brown thin parts
    # and cyan equipment from the original observed mask. Small bright cloth
    # tips/steel edges may lose pixels; this is recorded as uncertainty.
    if rank == 6:
        cyan = ((rgb[:, :, 1] > rgb[:, :, 0]*1.08) &
                (rgb[:, :, 2] > rgb[:, :, 0]*1.13))
        real_thin = mask & ((rgb.mean(axis=2) < .72) | cyan)
        mask = dilate(erode(mask, 3), 3) | real_thin
    mask = closing(mask)
    labels, comps = components(mask)
    if not comps:
        return mask, {'thresholds': thresholds[variant], 'components': [],
                      'warning': 'No reference foreground detected'}
    primary = comps[0]
    bx0, by0, bx1, by1 = primary['bbox']
    selected = [primary['label']]
    removed = []
    for c in comps[1:]:
        x1, y1, x2, y2 = c['bbox']
        pixels = rgb[labels == c['label']]
        mean = pixels.mean(axis=0)
        cyan = mean[1] > mean[0]*1.08 and mean[2] > mean[0]*1.13
        gold = mean[0] > mean[2]*1.6 and mean[1] > mean[2]*1.4
        density = c['area']/max(1, (x2-x1)*(y2-y1))
        near_body = (x2 >= bx0-w*.20 and x1 <= bx1+w*.20 and
                     y2 >= by0-h*.26 and y1 <= by1+2)
        mote = (rank == 6 and gold and mean.mean() > .53 and
                ((c['area'] < h*w*.013 and y2-y1 < h*.20 and x2-x1 < w*.17)
                 or density < .13))
        keep = ((cyan and c['area'] >= 12) or
                (near_body and c['area'] >= h*w*.0011)) and not mote
        if keep:
            selected.append(c['label'])
        else:
            removed.append({**c, 'meanRGB': mean.round(4).tolist(),
                            'reason': 'VI gold effect' if mote else 'small/far/background'})
    result = np.isin(labels, selected)
    return result, {'thresholds': list(thresholds[variant]),
                    'neutralGroundBandPx': 5,
                    'rankVIBrightStructureOpeningRadiusPx': 3 if rank == 6 else 0,
                    'selectedComponents': selected,
                    'removedComponents': removed,
                    'foregroundPixels': int(result.sum())}


def register(render, source_mask, alpha_threshold=128):
    a = np.asarray(render.getchannel('A')) >= alpha_threshold
    rb = bounding_box(a)
    sb = bounding_box(source_mask)
    if rb is None or sb is None:
        raise ValueError('Render or reference has no detectable physical silhouette')
    rh, sh = rb[3]-rb[1], sb[3]-sb[1]
    scale = sh/rh
    size = (max(1, round(render.width*scale)), max(1, round(render.height*scale)))
    resized = render.resize(size, Image.Resampling.LANCZOS)
    tx = (sb[0]+sb[2])/2-(rb[0]+rb[2])/2*scale
    ty = sb[3]-rb[3]*scale
    registered = Image.new('RGBA', (source_mask.shape[1], source_mask.shape[0]))
    registered.alpha_composite(resized, (round(tx), round(ty)))
    model_mask = np.asarray(registered.getchannel('A')) >= alpha_threshold
    meta = {'kind': 'translation_and_uniform_scale_only',
            'scaleX': scale, 'scaleY': scale, 'translationPixels': [tx, ty],
            'roundedTranslationPixels': [round(tx), round(ty)],
            'renderForegroundBbox': rb, 'referenceForegroundBbox': sb,
            'referenceDetectedFloorY': sb[3]-1,
            'renderDetectedFloorY': rb[3]-1,
            'heightNormalisation': 'overall physical silhouette including weapon',
            'noElasticWarp': True, 'noIoUOptimisation': True}
    return registered, model_mask, meta


def iou(a, b):
    union = int(np.logical_or(a, b).sum())
    return float(np.logical_and(a, b).sum()/union) if union else None


def boundary(mask):
    return np.argwhere(mask & ~erode(mask))[:, ::-1].astype(np.float32)


def nearest_distances(points, candidates):
    if not len(points) or not len(candidates):
        return np.array([], dtype=np.float32)
    distances = []
    for i in range(0, len(points), 160):
        p = points[i:i+160]
        d = ((p[:, None, 0]-candidates[None, :, 0])**2 +
             (p[:, None, 1]-candidates[None, :, 1])**2)
        distances.append(np.sqrt(d.min(axis=1)))
    return np.concatenate(distances)


def compare_masks(source, model):
    sb, mb = bounding_box(source), bounding_box(model)
    score = iou(source, model)
    p, q = boundary(source), boundary(model)
    d = np.concatenate((nearest_distances(p, q), nearest_distances(q, p)))
    h = max(1, sb[3]-sb[1])
    return {'silhouetteIoU': score,
            'iouTarget': .97, 'iouTargetMetForNominalMask': score >= .97,
            'boundaryMeanErrorPixels': float(d.mean()) if len(d) else None,
            'boundaryP95ErrorPixels': float(np.percentile(d, 95)) if len(d) else None,
            'boundaryMeanErrorPercentOverallHeight': float(d.mean()/h*100) if len(d) else None,
            'boundaryP95ErrorPercentOverallHeight': float(np.percentile(d, 95)/h*100) if len(d) else None,
            'registeredWidthDifferencePercentOverallHeight':
                ((mb[2]-mb[0])-(sb[2]-sb[0]))/h*100,
            'referenceForegroundPixels': int(source.sum()),
            'registeredModelForegroundPixels': int(model.sum()),
            'intersectionPixels': int((source & model).sum()),
            'unionPixels': int((source | model).sum()),
            'landmarkTargetPercentH': 1,
            'landmarkTargetEvaluated': False,
            'landmarkErrorPercentH': None,
            'landmarkReason': 'No independently annotated source anatomical landmarks; overall silhouette height is not bare-body H.'}


def white_composite(image):
    result = Image.new('RGBA', image.size, (246, 245, 241, 255))
    result.alpha_composite(image)
    return result.convert('RGB')


def overlay_image(crop, registered, source, model, caption, metric):
    w, h = crop.size
    result = Image.new('RGB', (w*4, h+62), '#f5f4ef')
    result.paste(crop.convert('RGB'), (0, 25))
    result.paste(white_composite(registered), (w, 25))
    over = crop.convert('RGBA')
    blue = np.zeros((h, w, 4), dtype=np.uint8)
    blue[model] = (0, 175, 220, 85)
    over.alpha_composite(Image.fromarray(blue, 'RGBA'))
    contours = np.zeros((h, w, 4), dtype=np.uint8)
    contours[source & ~erode(source)] = (222, 44, 110, 230)
    over.alpha_composite(Image.fromarray(contours, 'RGBA'))
    result.paste(over.convert('RGB'), (2*w, 25))
    delta = np.full((h, w, 3), 242, dtype=np.uint8)
    delta[source & model] = (110, 118, 117)
    delta[source & ~model] = (225, 55, 115)
    delta[model & ~source] = (0, 170, 220)
    result.paste(Image.fromarray(delta, 'RGB'), (3*w, 25))
    d = ImageDraw.Draw(result)
    for i, text in enumerate(('REFERENCE', '3D REGISTERED', 'OVERLAY', 'MASK DIFFERENCE')):
        d.text((i*w+5, 5), text, font=SMALL, fill='#21313b')
    d.text((5, h+31), caption+' | IoU %.4f | boundary mean %.2f px' %
           (metric['silhouetteIoU'], metric['boundaryMeanErrorPixels']),
           font=SMALL, fill='#21313b')
    d.text((5, h+47), 'Pink: reference only / Cyan: model only / Grey: overlap. Raster masks are uncertain.',
           font=SMALL, fill='#46545b')
    return result


def contact_sheet(family, entries, outdir):
    tile_w, tile_h = 235, 305
    sheet = Image.new('RGB', (tile_w*4, tile_h*6+58), '#f5f4ef')
    d = ImageDraw.Draw(sheet)
    d.text((12, 9), family.upper()+' | REAL 3D / REFERENCE COMPARISON',
           font=FONT, fill='#21313b')
    d.text((12, 29), 'Pink reference-only | Cyan 3D-only | Grey overlap | No effects in 3D',
           font=SMALL, fill='#46545b')
    for rank in range(1, 7):
        for v, view in enumerate(VIEWS):
            x, y = v*tile_w, 58+(rank-1)*tile_h
            e = entries.get((rank, view))
            d.text((x+6, y+5), ROMAN[rank-1]+' '+view.upper(),
                   font=SMALL, fill='#21313b')
            if e:
                im = Image.open(outdir/e['differenceFile']).convert('RGB')
                im.thumbnail((tile_w-8, tile_h-40), Image.Resampling.LANCZOS)
                sheet.paste(im, (x+(tile_w-im.width)//2, y+23))
                d.text((x+6, y+tile_h-17), 'IoU %.4f | mean %.2f px' %
                       (e['silhouetteIoU'], e['boundaryMeanErrorPixels']),
                       font=SMALL, fill='#21313b')
            else:
                d.text((x+10, y+130), 'RENDER NOT PRESENT', font=SMALL, fill='#777777')
    path = outdir/(family+'-comparison-contact.png')
    sheet.save(path)
    return path.name


def pilot_sheet(entries, outdir):
    pilots = [('archer', 1), ('archer', 6), ('cleric', 1),
              ('frostwarden', 1), ('runebreaker', 1)]
    tile_w, tile_h = 235, 305
    sheet = Image.new('RGB', (tile_w*4, tile_h*len(pilots)+48), '#f5f4ef')
    d = ImageDraw.Draw(sheet)
    d.text((12, 10), 'PILOT COMPARISON | ACTUAL NATIVE RENDERS', font=FONT, fill='#21313b')
    for row, (family, rank) in enumerate(pilots):
        for col, view in enumerate(VIEWS):
            x, y = col*tile_w, row*tile_h+48
            d.text((x+5, y+4), f'{family} {ROMAN[rank-1]} {view}', font=SMALL, fill='#21313b')
            entry = next((e for e in entries if e['family'] == family and
                          e['rank'] == rank and e['view'] == view), None)
            if entry:
                image = Image.open(outdir/entry['differenceFile']).convert('RGB')
                image.thumbnail((tile_w-8, tile_h-40), Image.Resampling.LANCZOS)
                sheet.paste(image, (x+(tile_w-image.width)//2, y+23))
                d.text((x+5, y+tile_h-17), 'IoU %.4f' % entry['silhouetteIoU'],
                       font=SMALL, fill='#21313b')
            else:
                d.text((x+10, y+130), 'RENDER NOT PRESENT', font=SMALL, fill='#777777')
    path = outdir/'pilot-comparison-contact.png'
    sheet.save(path)
    return path.name


def pilot_native_sheet(entries, outdir, root):
    pilots = [('archer', 1), ('archer', 6), ('cleric', 1),
              ('frostwarden', 1), ('runebreaker', 1)]
    tw, th = 160, 270
    sheet = Image.new('RGB', (tw*8, th*len(pilots)+48), '#f5f4ef')
    d = ImageDraw.Draw(sheet)
    d.text((12, 10), 'PILOT ACTUAL IMAGES | REFERENCE / REGISTERED NATIVE 3D',
           font=FONT, fill='#21313b')
    for row, (family, rank) in enumerate(pilots):
        for col, view in enumerate(VIEWS):
            entry = next((e for e in entries if e['family'] == family and
                          e['rank'] == rank and e['view'] == view), None)
            for pair in range(2):
                x, y = (col*2+pair)*tw, row*th+48
                label = 'REF' if pair == 0 else '3D'
                d.text((x+5, y+4), f'{family} {rank} {view} {label}',
                       font=SMALL, fill='#21313b')
                if not entry:
                    continue
                if pair == 0:
                    image = Image.open(root/entry['referenceFile']).convert('RGB').crop(
                        entry['sourceCropBoxPixels'])
                else:
                    image = white_composite(Image.open(outdir/entry['registeredFile']).convert('RGBA'))
                image.thumbnail((tw-8, th-38), Image.Resampling.LANCZOS)
                sheet.paste(image, (x+(tw-image.width)//2, y+23))
                if pair == 1:
                    d.text((x+5, y+th-14), 'IoU %.4f' % entry['silhouetteIoU'],
                           font=SMALL, fill='#21313b')
    path = outdir/'pilot-native-reference-contact.png'
    sheet.save(path)
    return path.name


def analyse(args):
    root = args.root.resolve()
    refs = root/args.references
    renders = root/args.renders
    output = root/args.output
    output.mkdir(parents=True, exist_ok=True)
    for folder in ('overlays', 'reference-masks', 'differences', 'registered'):
        (output/folder).mkdir(exist_ok=True)
    start = time.time()
    entries, missing, contacts, invalid = [], [], [], []
    for family in FAMILIES:
        visual = VISUAL_ID.get(family, family)
        refpath = refs/(visual+'-variant-b-turnaround.png')
        source = Image.open(refpath).convert('RGB')
        if source.size != (941, 1672):
            raise ValueError(f'{refpath}: layout measurements require 941x1672, got {source.size}')
        layout = LAYOUT[visual]
        grids = grid_positions(np.asarray(source, dtype=np.float32)/255)
        family_entries = {}
        for rank in range(1, 7):
            for col, view in enumerate(VIEWS):
                stem = f'{family}-t{rank}-{view}'
                renderpath = renders/(stem+'.png')
                if not renderpath.exists():
                    missing.append(stem)
                    continue
                try:
                    with Image.open(renderpath) as loaded:
                        if loaded.mode != 'RGBA':
                            raise ValueError(f'must be transparent RGBA, got {loaded.mode}')
                        render = loaded.copy()
                except (OSError, ValueError) as ex:
                    missing.append(stem)
                    invalid.append({'render': stem, 'error': str(ex)})
                    continue
                if np.asarray(render.getchannel('A')).min() == 255:
                    missing.append(stem)
                    invalid.append({'render': stem, 'error': 'Opaque background; alpha cannot isolate geometry'})
                    continue
                cropbox = [layout['x'][col]+2, layout['y'][rank-1]+1,
                           layout['x'][col+1]-2, layout['y'][rank]-1]
                crop = source.crop(cropbox)
                floor = min(crop.height-1, layout['floor'][rank-1]-cropbox[1])
                masks, metadata = {}, {}
                for variant in ('strict', 'nominal', 'loose'):
                    masks[variant], metadata[variant] = reference_mask(
                        crop, visual, rank, floor, grids,
                        (cropbox[0], cropbox[1]), variant)
                    binary_image(masks[variant]).save(output/'reference-masks'/(stem+'-'+variant+'.png'))
                registered, model, registration = register(render, masks['nominal'])
                metrics = compare_masks(masks['nominal'], model)
                alternatives = [iou(m, model) for m in masks.values()]
                entry = {'family': family, 'visualClass': visual, 'rank': rank,
                         'view': view, 'referenceFile': str(refpath.relative_to(root)),
                         'renderFile': str(renderpath.relative_to(root)),
                         'sourceCropBoxPixels': cropbox,
                         'sourceFloorCeilingPixels': layout['floor'][rank-1],
                         'sourceMaskMetadata': metadata,
                         'registration': registration,
                         **metrics,
                         'segmentationIoUInterval': [min(alternatives), max(alternatives)],
                         'segmentationIoUs': {k: iou(v, model) for k, v in masks.items()},
                         'maskUncertainty': 'Raster lighting, antialiasing, grid overlap, shadows and VI gold effect separation (3px bright-structure opening may remove narrow bright cloth or steel tips); strict/loose masks are sensitivity bounds, not calibrated confidence intervals.',
                         'overlayFile': 'overlays/'+stem+'.png',
                         'differenceFile': 'differences/'+stem+'.png',
                         'registeredFile': 'registered/'+stem+'.png'}
                if masks['nominal'][0].any() or masks['nominal'][-1].any():
                    entry['maskUncertainty'] += ' Foreground touches source row crop boundary; reference clipping possible.'
                registered.save(output/entry['registeredFile'])
                overlay_image(crop, registered, masks['nominal'], model,
                              f'{visual} {ROMAN[rank-1]} {view}', metrics).save(output/entry['overlayFile'])
                delta = np.full((*model.shape, 3), 245, dtype=np.uint8)
                delta[masks['nominal'] & model] = (112, 119, 118)
                delta[masks['nominal'] & ~model] = (225, 55, 115)
                delta[model & ~masks['nominal']] = (0, 170, 220)
                Image.fromarray(delta, 'RGB').save(output/entry['differenceFile'])
                entries.append(entry)
                family_entries[(rank, view)] = entry
                print(f"{stem}: IoU={metrics['silhouetteIoU']:.4f}, boundary_mean={metrics['boundaryMeanErrorPixels']:.2f}px", flush=True)
        if family_entries:
            contacts.append({'family': family, 'file': contact_sheet(family, family_entries, output)})
    pilot = pilot_sheet(entries, output)
    pilot_native = pilot_native_sheet(entries, output, root)
    scores = [e['silhouetteIoU'] for e in entries]
    summary = {'generatedAtUnix': time.time(), 'expectedViews': 192,
               'comparedViews': len(entries), 'missingRenders': missing,
               'invalidOrIncompleteRenders': invalid,
               'meanSilhouetteIoU': float(np.mean(scores)) if scores else None,
               'minSilhouetteIoU': min(scores) if scores else None,
               'maxSilhouetteIoU': max(scores) if scores else None,
               'nominalMaskIouTargetMetCount': sum(e['iouTargetMetForNominalMask'] for e in entries),
               'nominalMaskIouTargetNotMetCount': sum(not e['iouTargetMetForNominalMask'] for e in entries),
               'landmarkTargetEvaluatedCount': 0,
               'scope': 'Real silhouette comparison only; successful export is not evidence of reference fidelity.',
               'registrationRule': 'Only uniform scale and translation, aligned to actual masks/bbox/floor; no elastic warp or silhouette-optimised fitting.',
               'maskMethod': 'Local RGB background/color-distance threshold; observed grid suppression; foreground connected components; conservative VI gold aura/mote removal. Strict and loose threshold variants retained.',
               'measurementLimitation': 'Generated references contain mutually inconsistent profiles and lighting. Silhouette segmentation sensitivity is reported. Independent anatomical landmarks are not annotated; no 1% H claim is made.',
               'elapsedSeconds': time.time()-start,
               'contacts': contacts, 'pilotContact': pilot,
               'pilotNativeReferenceContact': pilot_native}
    (output/'comparison-results.json').write_text(
        json.dumps({'summary': summary, 'views': entries}, indent=2), encoding='utf-8')
    fields = ['family', 'visualClass', 'rank', 'view', 'silhouetteIoU',
              'iouTarget', 'iouTargetMetForNominalMask', 'boundaryMeanErrorPixels',
              'boundaryP95ErrorPixels', 'boundaryMeanErrorPercentOverallHeight',
              'registeredWidthDifferencePercentOverallHeight',
              'landmarkTargetEvaluated', 'landmarkErrorPercentH',
              'segmentationIoULow', 'segmentationIoUHigh', 'sourceCropBoxPixels',
              'referenceFile', 'renderFile', 'maskUncertainty']
    with (output/'comparison-results.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for e in entries:
            row = {k: e.get(k) for k in fields}
            row.update(segmentationIoULow=e['segmentationIoUInterval'][0],
                       segmentationIoUHigh=e['segmentationIoUInterval'][1])
            writer.writerow(row)
    cards = []
    for c in contacts:
        cards.append(f'<a href="{html.escape(c["file"])}"><img src="{html.escape(c["file"])}" alt="{c["family"]} comparison"><b>{c["family"]}</b></a>')
    table = ''.join('<tr><td>'+html.escape(e['visualClass'])+'</td><td>'+str(e['rank'])+
                    '</td><td>'+e['view']+'</td><td>%.4f</td><td>%.2f px</td><td>' %
                    (e['silhouetteIoU'], e['boundaryMeanErrorPixels'])+
                    ('meets nominal mask target' if e['iouTargetMetForNominalMask'] else 'TARGET NOT MET')+
                    '</td><td><a href="'+html.escape(e['overlayFile'])+'">overlay</a></td></tr>' for e in entries)
    report = f'''<!doctype html><meta charset="utf-8"><title>Defender v3 reference comparison</title>
<style>body{{font:15px system-ui;background:#f5f4ef;color:#21313b;max-width:1250px;margin:30px auto;padding:15px}}a{{color:#126b9b}}.cards{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}}.cards img{{width:100%}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #cad1d3;padding:6px;text-align:left}}.note{{background:#fff4d8;padding:15px}}@media(max-width:700px){{.cards{{grid-template-columns:repeat(2,1fr)}}}}</style>
<h1>Actual 3D / reference comparison</h1><p>{len(entries)} / 192 views analysed. Nominal IoU target: 0.97. {summary['nominalMaskIouTargetNotMetCount']} analysed views below target.</p>
<p class="note">These are real pixels and real scores. Reference masks have uncertainty from grid lines, lighting, shadows and rank VI effects. The strict/loose sensitivity range is in JSON/CSV. Only a uniform scale and translation register each view. No anatomy-landmark 1% H pass is claimed because independent source landmarks are not annotated. Read comparison-results.json for actual limitations.</p>
<p><a href="comparison-results.json">Complete JSON and mask metadata</a> · <a href="comparison-results.csv">CSV measurements</a> · <a href="{pilot}">Pilot differences</a> · <a href="{pilot_native}">Pilot native / reference images</a></p>
<div class="cards">{''.join(cards)}</div><h2>Per-view actual scores</h2>
<table><thead><tr><th>Class</th><th>Rank</th><th>View</th><th>IoU</th><th>Mean boundary error</th><th>Result</th><th>Review</th></tr></thead><tbody>{table}</tbody></table>'''
    (output/'index.html').write_text(report, encoding='utf-8')
    print(json.dumps(summary, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--references', type=Path, default=Path('output/design/basic-defender-turnarounds-v1'))
    parser.add_argument('--renders', type=Path, default=Path('blender/renders/hooded-turnarounds-v3'))
    parser.add_argument('--output', type=Path, default=Path('output/design/hooded-turnarounds-v3/comparison'))
    analyse(parser.parse_args())


if __name__ == '__main__':
    main()

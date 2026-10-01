import * as THREE from 'three';

// Preserved inactive Kushek stand-in; the live runebreaker family uses Engineer.
export function kushekFallback(cloth, k) {
  const {box, beam, sphere, cylinder, mesh, optimize} = k;
  const root = new THREE.Group();
  const black = '#202326', rubber = '#242b2b', blonde = '#d8b865';
  const skin = '#e9b699', steel = '#b4c1c3', brass = '#c6a86a';
  cylinder(root, .44, .44, .11, '#66766b', [0, .055, 0], 8);
  cylinder(root, .385, .415, .07, '#adb4a0', [0, .125, 0], 8);
  const inlay = mesh(root, new THREE.TorusGeometry(.353, .013, 4, 24), cloth, [0, .166, 0]);
  inlay.rotation.x = Math.PI/2;
  for (const x of [-.128, .128]) {
    box(root, [.20, .07, .31], '#161c1c', [x, .211, -.065]);
    cylinder(root, .087, .095, .31, rubber, [x, .422, 0], 12);
    const toe = sphere(root, .12, rubber, [x, .27, -.075]);toe.scale.set(.86, .66, 1.32);
    beam(root, [x, .59, 0], [x*.82, .94, 0], .155, black);
  }
  const hips = sphere(root, .20, black, [0, .92, 0]);hips.scale.set(1, .84, .77);
  const shirt = sphere(root, .238, cloth, [0, 1.185, 0]);shirt.scale.set(.94, 1.05, .68);
  box(root, [.264, .306, .054], black, [0, 1.164, -.159]);
  box(root, [.277, .291, .044], black, [0, 1.165, .143]);
  for (const x of [-.117, .117]) {
    beam(root, [x, 1.27, -.18], [x, 1.389, .03], .042, black);
    beam(root, [x, 1.389, .03], [x, 1.27, .153], .042, black);
    box(root, [.038, .042, .012], brass, [x, 1.266, -.201]);
  }
  box(root, [.148, .094, .025], black, [0, 1.175, -.196]);
  cylinder(root, .064, .068, .17, skin, [0, 1.449, -.012], 12);
  const face = sphere(root, .18, skin, [0, 1.69, -.018]);face.scale.set(.87, 1.13, .71);
  const jaw = sphere(root, .118, skin, [0, 1.608, -.055]);jaw.scale.set(1, .83, .80);
  sphere(root, .029, skin, [0, 1.674, -.161]);
  for (const x of [-.059, .059]) {
    const white = sphere(root, .038, '#f9f3e4', [x, 1.716, -.142]);white.scale.set(1, .66, .30);
    const iris = sphere(root, .019, '#388956', [x, 1.716, -.157]);iris.scale.set(.90, 1, .30);
    const pupil = sphere(root, .009, '#142722', [x, 1.716, -.166]);pupil.scale.set(.90, 1.20, .30);
    beam(root, [x-.033, 1.752, -.155], [x+.033, 1.752, -.146], .013, blonde);
  }
  box(root, [.06, .01, .015], '#a36560', [0, 1.595, -.153]);
  const hair = sphere(root, .17, blonde, [0, 1.81, .019]);hair.scale.set(.96, .55, .79);
  const back = sphere(root, .15, blonde, [0, 1.751, .077]);back.scale.set(.98, .98, .57);
  beam(root, [-.11, 1.835, -.08], [.08, 1.82, -.11], .052, blonde);
  sphere(root, .064, blonde, [0, 1.815, .171]);
  beam(root, [0, 1.80, .19], [.07, 1.61, .268], .112, blonde);
  beam(root, [.07, 1.61, .268], [.035, 1.47, .305], .083, blonde);
  const tie = mesh(root, new THREE.TorusGeometry(.054, .009, 4, 16), black, [0, 1.81, .178]);
  for (const side of [-1, 1]) {
    sphere(root, .119, cloth, [side*.221, 1.35, 0]);
    beam(root, [side*.22, 1.35, 0], [side*.279, 1.24, -.043], .16, cloth);
    beam(root, [side*.279, 1.25, -.043], [side*.325, 1.17, -.086], .11, skin);
    beam(root, [side*.325, 1.17, -.086], [side*.372, 1.10, -.196], .107, skin);
    sphere(root, .066, skin, [side*.372, 1.10, -.20]);
  }
  beam(root, [.387, .84, -.18], [.387, 1.378, -.18], .049, '#967354');
  box(root, [.255, .121, .114], steel, [.387, 1.375, -.18]);
  box(root, [.026, .125, .122], steel, [.52, 1.378, -.18]);
  for (const side of [-1, 1]) beam(root, [.275, 1.365, -.18+side*.032], [.229, 1.412, -.18+side*.049], .032, steel);
  box(root, [.075, .62, .034], '#eee6ca', [-.35, 1.17, -.26]);
  for (let index = 0; index < 12; index++) box(root, [index%5===0?.051:.024, .005, .007], '#343c3c', [-.365, .885+index*.049, -.282]);
  return optimize(root);
}

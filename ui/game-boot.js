// Keep the first loading view mounted while authentication and menu rendering settle.
export function finishGameBoot(doc=globalThis.document){
 doc.body.removeAttribute('data-game-booting');
 doc.getElementById('game-boot')?.remove();
}
export function failGameBoot(error,doc=globalThis.document){
 console.error(error);
 const boot=doc.getElementById('game-boot');
 if(!boot)return;
 boot.querySelector('p').textContent='The game could not start. Please try again.';
 const button=doc.createElement('button');button.textContent='Try again';button.onclick=()=>globalThis.location.reload();
 boot.append(button);
}
export async function bootToMenu(initialize,showMenu,doc=globalThis.document){
 await initialize();
 await showMenu();
 finishGameBoot(doc);
}

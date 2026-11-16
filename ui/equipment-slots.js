// Native vector silhouettes share the game's antique-brass engraving style.
const shapes={
 head:'<path d="M9 28V17a15 15 0 0 1 30 0v11l-8 11H17Z"/><path d="M9 22h30M24 22v14M15 28h4m10 0h4M19 7l5-4 5 4"/>',
 neck:'<path d="M10 9c0 18 28 18 28 0M14 8c0 13 20 13 20 0M24 22v5m-7 6 7-7 7 7-7 10Z"/>',
 chest:'<path d="m15 7 9 5 9-5 9 8-7 9-3-4 1 21H15l1-21-3 4-7-9Z"/><path d="M24 13v26M17 25h14M17 32h14"/>',
 weapon:'<path d="m26 4 8 2-2 8-15 19-6-5Zm-15 24 10 8M7 39l8-8m-9 8 4 4M27 10 16 26"/>',
 offhand:'<path d="m24 5 16 6v12c0 10-16 20-16 20S8 33 8 23V11Z"/><path d="m24 12 9 4v7c0 5-9 12-9 12s-9-7-9-12v-7ZM24 13v20"/>',
 gloves:'<path d="m15 40-4-15 2-16 5 1 1 11V6h5v14l2-13 5 1-1 14 4-10 5 2-5 18-6 8Z"/><path d="M15 34h16M17 40v4h11v-4"/>',
 cloak:'<path d="M24 5c-5 0-8 6-8 10L7 41c8-5 11 5 17 0 6 5 9-5 17 0L32 15c0-4-3-10-8-10Z"/><path d="M16 15h16M24 16v23M16 24l-3 12m19-12 3 12"/>',
 feet:'<path d="M15 7h18l-2 22 9 7v7H9v-9l7-8Z"/><path d="M16 13h16M17 19h14M12 34h17m-13-7h15M10 39h28"/>',
 ring:'<path d="m24 4 9 8-9 8-9-8Zm-10 14a15 15 0 1 0 20 0M17 23a9 9 0 1 0 14 0"/><path d="m15 12 9 1 9-1M24 5v14"/>'
};
export function equipmentSlotIcon(slot){const id=slot.startsWith('ring')?'ring':slot;return `<svg class="equipment-slot-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${shapes[id]||shapes.ring}</svg>`;}
export const backpackIcon=()=>'<svg class="backpack-crest" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 13V9c0-7 18-7 18 0v4M13 23c0-13 38-13 38 0l3 30c-7 8-37 8-44 0Z"/><path d="M12 26c12 11 28 11 40 0M21 17v37m22-37v37M24 35h16v17H24Z"/><path d="M28 32h8v9h-8ZM16 49h4m24 0h4"/></svg>';

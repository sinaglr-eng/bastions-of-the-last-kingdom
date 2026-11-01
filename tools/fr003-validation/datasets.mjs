import {loadCurrentDatasets} from '../current-datasets.mjs';
// Future simulations follow current rules. Historical contracts request a
// named revision explicitly; FR-003's before fixture remains FR-002.
export function loadFr003Datasets({baseline=false,revision='current'}={}){
 return loadCurrentDatasets({revision:baseline?'fr002':revision});
}

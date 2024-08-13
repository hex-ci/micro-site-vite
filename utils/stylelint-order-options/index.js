import special from './groups/special.js';
import positioning from './groups/positioning.js';
import boxModel from './groups/boxModel.js';
import typography from './groups/typography.js';
import visual from './groups/visual.js';
import animation from './groups/animation.js';
import misc from './groups/misc.js';

export default [
  ['Special', special],
  ['Positioning', positioning],
  ['Box Model', boxModel],
  ['Typography', typography],
  ['Visual', visual],
  ['Animation', animation],
  ['Misc', misc],
].map(([groupName, properties]) => ({
  emptyLineBefore: 'never',
  properties,
  groupName,
}));

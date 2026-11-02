/* The settings Logseq shows for the plugin (Plugins, then the gear on its card). What the plugin remembers on its own (what
   was taken or passed over in suggested links, the limits tuned for each graph) is kept in keys this list does not show. */
(function () {
const Flow = (window.Flow ||= {});
Flow.settingsSchema = [
  { key: 'proposalsHeading', type: 'heading', title: 'Proposals while you write', default: null, description: 'What the properties of a bullet could hold shows faintly under it while you write, and is filled in when you leave the bullet.' },
  { key: 'proposals', type: 'boolean', title: 'Propose values while I write', default: true,
    description: 'Sure ones (a page you linked, the page you are on, the journal day where your graph always dates a thing the day it is written) are filled in when you leave the bullet. Guessed ones (dotted) are filled in only when you leave with Enter. Escape hides them until you type again.' },
  { key: 'proposalsSkipGraphs', type: 'string', title: 'Not in these graphs', default: '', description: 'Graph names, separated by commas. Empty: proposals work in every graph.' },
  { key: 'proposalsHideEmpty', type: 'boolean', title: 'Hide empty properties until something is proposed', default: true,
    description: 'Under a bullet, a property with no value stays hidden until the plugin proposes something for it (a doctor linked in a consultation brings Provider up, with the doctor in grey). Under the bullet you are writing, they stay, faint, so nothing comes and goes. Only in graphs where proposals are on.' },
  { key: 'proposalsStepKeys', type: 'string', keys: true, title: 'Keys for stepping through a bullet’s properties', default: 'alt+enter',
    description: 'Option-Enter: opens the first property that is empty or holds a guess (Logseq’s own list for it); Enter there keeps your choice and moves on, Tab skips, Escape comes back to the words; Option-Enter again finishes the bullet. Empty binds none.' },
  { key: 'proposalsTagKeys', type: 'string', keys: true, title: 'Keys for choosing a tag', default: 'alt+t',
    description: 'Option-T, on a bullet that has no tag: a short list of the tags the pages the line names could take (linked or in plain words), best first by its words. Up and Down move, Enter picks, Escape closes; picking gives the bullet the tag and proposes its properties. Nothing is written until you pick. Empty binds none.' },
  { key: 'proposalsAcceptKeys', type: 'string', keys: true, title: 'Keys for accepting everything shown without a new bullet', default: 'mod+alt+enter',
    description: 'Cmd-Option-Enter: everything shown is accepted, as with Enter, and the bullet is left with no new bullet made. Empty binds none.' },
  { key: 'citeKeys', type: 'string', keys: true, title: 'Keys for citing', default: 'alt+c',
    description: 'Option-C, in a bullet: opens the line under it to say where it came from, as /Cite does, for a citation at the cursor. Empty binds none.' },
  { key: 'pageKeys', type: 'string', keys: true, title: 'Keys for making the bullet a page', default: 'mod+;',
    description: 'Cmd-;: the bullet’s words become a page, and the bullet stays in the outline with the page’s children under it, the same children in both places. With a page by that name already, the bullet shows that page. Empty binds none.' },
  { key: 'tagEagerness', type: 'enum', title: 'How readily a tag is suggested', default: 'balanced', enumChoices: ['careful', 'balanced', 'eager'], enumPicker: 'select',
    description: 'A bullet with no tag that reads like earlier tagged ones is offered that tag, with the tag\'s properties as guesses; Enter takes it, Undo puts it back. A close lookalike among the earlier lines, or, failing that, the words a tag\'s lines use as a whole. Careful: about one fresh line in three gets one, almost never wrong. Balanced: about one in two. Eager: a few more, and now and then a wrong one or a tag on a plain note. Measured on the Illness Test Graph (README, "How readily a tag is suggested"). Applies at once.' },
  { key: 'linkHeading', type: 'heading', title: 'Suggested links', default: null, description: 'While you write, the rest of a page’s name shows in grey after the cursor; Right arrow makes the link.' },
  { key: 'linkSuggest', type: 'boolean', title: 'Suggest links while typing', default: true,
    description: 'When the last words typed start a page’s name, or a word in it, the rest of the name shows in grey. Right arrow turns the words into [[the page]]; Cmd+Z takes it back. Anything else ignores it.' },
  { key: 'linkSuggestRightArrow', type: 'boolean', title: 'Right arrow takes the suggested link', default: true, description: 'Without grey words showing, Right arrow does what it always does.' },
  { key: 'linkSuggestHyperTap', type: 'boolean', title: 'A tap of the Hyper key takes the suggested link', default: true,
    description: 'If Caps Lock is your Hyper key (Cmd+Ctrl+Opt+Shift, set up with Karabiner or the Hyperkey app), tapping it on its own while grey words show makes the link. Holding Hyper with another key works as before. An Escape your setup sends on a tap is ignored.' },
  { key: 'linkSuggestKeys', type: 'string', keys: true, title: 'A plain key that takes the suggested link too', default: '', description: 'For example Cmd Ctrl Option Shift Space. Empty binds none. (Tab would stop indenting while grey words show.)' },
  { key: 'linkSuggestMinLetters', type: 'number', title: 'Letters typed before a suggestion shows', default: 5, description: 'The words of a name count together ("Dr. Mei" is 5). Fewer shows suggestions sooner and more often.' },
  { key: 'linkSuggestPause', type: 'number', title: 'Pause before a suggestion shows (milliseconds)', default: 350, description: 'Nothing pops up while you type quickly. 0 shows suggestions as you type.' },
  { key: 'linkSuggestLearn', type: 'boolean', title: 'Learn from the graph and from what you take', default: true,
    description: 'A name the graph usually links is offered from three letters; one it usually writes plain is not offered. A page that would fill one of the bullet’s empty properties comes first. What you take or pass over is remembered for this graph.' },
];
})();

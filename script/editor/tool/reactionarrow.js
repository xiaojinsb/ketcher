var Action = require('../action');
var HoverHelper = require('./helper/hover');
var EditorTool = require('./base');

var ui = global.ui;

var ReactionArrowTool = function (editor) {
	this.editor = editor;

	this._hoverHelper = new HoverHelper(this);
};
ReactionArrowTool.prototype = new EditorTool();
ReactionArrowTool.prototype.OnMouseDown = function (event) {
	var rnd = this.editor.render;
	var ci = rnd.findItem(event, ['rxnArrows']);
	if (ci && ci.map == 'rxnArrows') {
		this._hoverHelper.hover(null);
		this.editor._selectionHelper.setSelection(ci);
		this.dragCtx = {
			xy0: rnd.page2obj(event)
		};
	}
};
ReactionArrowTool.prototype.OnMouseMove = function (event) {
	var rnd = this.editor.render;
	if ('dragCtx' in this) {
		if (this.dragCtx.action)
			this.dragCtx.action.perform();
		this.dragCtx.action = Action.fromMultipleMove(
			this.editor._selectionHelper.selection,
		rnd.page2obj(event).sub(this.dragCtx.xy0)
		);
		rnd.render.update();
	} else {
		this._hoverHelper.hover(rnd.findItem(event, ['rxnArrows']));
	}
};
ReactionArrowTool.prototype.OnMouseUp = function (event) {
	var rnd = this.editor.render;
	if ('dragCtx' in this) {
		ui.addUndoAction(this.dragCtx.action, false); // TODO investigate, subsequent undo/redo fails
		rnd.update();
		delete this.dragCtx;
	} else if (rnd.ctab.molecule.rxnArrows.count() < 1) {
		ui.addUndoAction(Action.fromArrowAddition(rnd.page2obj(event)));
		rnd.update();
	}
};

module.exports = ReactionArrowTool;
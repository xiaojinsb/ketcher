/****************************************************************************
 * Copyright (C) 2009-2010 GGA Software Services LLC
 *
 * This file may be distributed and/or modified under the terms of the
 * GNU Affero General Public License version 3 as published by the Free
 * Software Foundation and appearing in the file LICENSE.GPL included in
 * the packaging of this file.
 *
 * This file is provided AS IS with NO WARRANTY OF ANY KIND, INCLUDING THE
 * WARRANTY OF DESIGN, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 ***************************************************************************/

// rnd.ReStruct constructor and utilities are defined here
//
// ReStruct is to store all the auxiliary information for
//  chem.Struct while rendering
if (!window.chem || !util.Vec2 || !chem.Struct || !window.rnd || !rnd.Visel)
	throw new Error("Vec2, Molecule and Visel should be defined first");

if (!window.rnd)
	rnd = {};

rnd.ReObject = function()  // TODO ??? should it be in ReStruct namespace
{
    this.__ext = new util.Vec2(0.05 * 3, 0.05 * 3);
};

rnd.ReObject.prototype.init = function(viselType)
{
    this.visel = new rnd.Visel(viselType);

    this.highlight = false;
    this.highlighting = null;
    this.selected = false;
    this.selectionPlate = null;
};

rnd.ReObject.prototype.calcVBox = function(render) {
    if (this.visel.boundingBox) {
        return this.visel.boundingBox
            .transform(render.scaled2obj, render);
    }
};

rnd.ReObject.prototype.drawHighlight = function(render) {
    console.log('ReObject.drawHighlight is not overridden');
};

rnd.ReObject.prototype.setHighlight = function(highLight, render) { // TODO render should be field
    if (highLight) {
        var noredraw = this.highlighting && !this.highlighting.removed;
        // rbalabanov: here is temporary fix for "drag issue" on iPad
        //BEGIN
        noredraw = noredraw && (!('hiddenPaths' in rnd.ReStruct.prototype) || rnd.ReStruct.prototype.hiddenPaths.indexOf(this.highlighting) < 0);
        //END
        if (noredraw) {
            this.highlighting.show();
        }
        else this.highlighting = this.drawHighlight(render);
    } else {
        if (this.highlighting) this.highlighting.hide();
    }
    this.highlight = highLight;
};

rnd.ReObject.prototype.makeSelectionPlate = function(render) {
    console.log('ReObject.makeSelectionPlate is not overridden');
};

rnd.ReAtom = function (/*chem.Atom*/atom)
{
    this.init(rnd.Visel.TYPE.ATOM);

	this.a = atom; // TODO rename a to item
	this.showLabel = false;

	this.hydrogenOnTheLeft = false;

	this.sGroupHighlight = false;
	this.sGroupHighlighting = null;

	this.component = -1;
};
rnd.ReAtom.prototype = new rnd.ReObject();

rnd.ReAtom.prototype.drawHighlight = function(render) {
    var ret = render.paper.circle(
        this.a.ps.x, this.a.ps.y, render.styles.atomSelectionPlateRadius
    ).attr(render.styles.highlightStyle);
    render.addItemPath(this.visel, 'highlighting', ret);
    return ret;
};

rnd.ReAtom.prototype.makeSelectionPlate = function (restruct, paper, styles) {
	return paper.circle(this.a.ps.x, this.a.ps.y, styles.atomSelectionPlateRadius)
	.attr(styles.selectionStyle);
};

rnd.ReBond = function (/*chem.Bond*/bond)
{
    this.init(rnd.Visel.TYPE.BOND);

	this.b = bond; // TODO rename b to item
	this.doubleBondShift = 0;
};
rnd.ReBond.prototype = new rnd.ReObject();

rnd.ReBond.prototype.drawHighlight = function(render)
{
    render.ctab.bondRecalc(render.settings, this);
    var ret = render.paper.ellipse(
        this.b.center.x, this.b.center.y, this.b.sa, this.b.sb
    ).rotate(this.b.angle).attr(render.styles.highlightStyle);
    render.addItemPath(this.visel, 'highlighting', ret);
    return ret;
};

rnd.ReBond.prototype.makeSelectionPlate = function (restruct, paper, styles) {
	restruct.bondRecalc(restruct.render.settings, this);
	return paper
	.ellipse(this.b.center.x, this.b.center.y, this.b.sa, this.b.sb)
	.rotate(this.b.angle)
	.attr(styles.selectionStyle);
};

rnd.ReStruct = function (molecule, render)
{
	this.render = render;
	this.atoms = new util.Map();
	this.bonds = new util.Map();
	this.reloops = new util.Map();
	this.rxnPluses = new util.Map();
	this.rxnArrows = new util.Map();
    this.frags = new util.Map();
    this.rgroups = new util.Map();
    this.sgroups = new util.Map();
	this.molecule = molecule || new chem.Struct();
	this.initialized = false;
	this.layers = [];
	this.initLayers();
	this.chiral = {
		p: null,
		ps: null,
		visel: new rnd.Visel(rnd.Visel.TYPE.CHIRAL)
	};

	this.connectedComponents = new util.Pool();
	this.ccFragmentType = new util.Map();

	for (var map in rnd.ReStruct.maps) {
		this[map+'Changed'] = {};
	}
	this.structChanged = false;
//	this.viselsChanged = {};

	molecule.atoms.each(function(aid, atom){
		this.atoms.set(aid, new rnd.ReAtom(atom));
	}, this);

	molecule.bonds.each(function(bid, bond){
		this.bonds.set(bid, new rnd.ReBond(bond));
	}, this);

	molecule.loops.each(function(lid, loop){
		this.reloops.set(lid, new rnd.ReLoop(loop));
	}, this);

	molecule.rxnPluses.each(function(id, item){
		this.rxnPluses.set(id, new rnd.ReRxnPlus(item));
	}, this);

	molecule.rxnArrows.each(function(id, item){
		this.rxnArrows.set(id, new rnd.ReRxnArrow(item));
	}, this);

    molecule.frags.each(function(id, item) {
        this.frags.set(id, new rnd.ReFrag(item));
    }, this);

    molecule.rgroups.each(function(id, item) {
        this.rgroups.set(id, new rnd.ReRGroup(item));
    }, this);

    molecule.sgroups.each(function(id, item) {
        this.sgroups.set(id, new rnd.ReSGroup(item));
    }, this);

	this.coordProcess();

	this.tmpVisels = [];
};

rnd.ReStruct.maps = {
	'atoms':     0,
	'bonds':     1,
	'rxnPluses': 2,
	'rxnArrows': 3,
    'frags':     4,
    'rgroups':   5
};

rnd.ReStruct.prototype.connectedComponentRemoveAtom = function (aid, atom) {
	atom = atom || this.atoms.get(aid);
	if (atom.component < 0)
		return;
	var cc = this.connectedComponents.get(atom.component);
	util.Set.remove(cc, aid);
	if (util.Set.size(cc) < 1)
		this.connectedComponents.remove(atom.component);

	atom.component = -1;
};

rnd.ReStruct.prototype.printConnectedComponents = function () {
	var strs = [];
	this.connectedComponents.each(function(ccid, cc){
		strs.push(' ' + ccid + ':[' + util.Set.list(cc).toString() + '].' + util.Set.size(cc).toString());
	}, this);
	console.log(strs.toString());
};

rnd.ReStruct.prototype.clearConnectedComponents = function () {
	this.connectedComponents.clear();
	this.atoms.each(function(aid, atom) {
		atom.component = -1;
	});
};

rnd.ReStruct.prototype.getConnectedComponent = function (aid, adjacentComponents) {
	var list = (typeof(aid['length']) == 'number') ? util.array(aid) : [aid];
	var ids = util.Set.empty();

	while (list.length > 0) {
		(function() {
			var aid = list.pop();
			util.Set.add(ids, aid);
			var atom = this.atoms.get(aid);
			if (atom.component >= 0) {
				util.Set.add(adjacentComponents, atom.component);
			}
			for (var i = 0; i < atom.a.neighbors.length; ++i) {
				var neiId = this.molecule.halfBonds.get(atom.a.neighbors[i]).end;
				if (!util.Set.contains(ids, neiId))
					list.push(neiId);
			}
		}).apply(this);
	}

	return ids;
};

rnd.ReStruct.prototype.addConnectedComponent = function (ids) {
	var compId = this.connectedComponents.add(ids);
	var adjacentComponents = util.Set.empty();
	var atomIds = this.getConnectedComponent(util.Set.list(ids), adjacentComponents);
	util.Set.remove(adjacentComponents, compId);
	var type = -1;
	util.Set.each(atomIds, function(aid) {
		var atom = this.atoms.get(aid);
		atom.component = compId;
		if (atom.a.rxnFragmentType != -1) {
			if (type != -1 && atom.a.rxnFragmentType != type)
				throw new Error('reaction fragment type mismatch');
			type = atom.a.rxnFragmentType;
		}
	}, this);

	this.ccFragmentType.set(compId, type);
	return compId;
};

rnd.ReStruct.prototype.removeConnectedComponent = function (ccid) {
	util.Set.each(this.connectedComponents.get(ccid), function(aid) {
		this.atoms.get(aid).component = -1;
	}, this);
	return this.connectedComponents.remove(ccid);
};

rnd.ReStruct.prototype.connectedComponentMergeIn = function (ccid, set) {
	util.Set.each(set, function(aid) {
		this.atoms.get(aid).component = ccid;
	}, this);
	util.Set.mergeIn(this.connectedComponents.get(ccid), set);
};

rnd.ReStruct.prototype.assignConnectedComponents = function () {
	this.atoms.each(function(aid,atom){
		if (atom.component >= 0)
			return;
		var adjacentComponents = util.Set.empty();
		var ids = this.getConnectedComponent(aid, adjacentComponents);
		util.Set.each(adjacentComponents, function(ccid){
			this.removeConnectedComponent(ccid);
		}, this);
		this.addConnectedComponent(ids);
	}, this);
};

rnd.ReStruct.prototype.connectedComponentGetBoundingBox = function (ccid, cc, bb) {
	cc = cc || this.connectedComponents.get(ccid);
	bb = bb || {'min':null, 'max':null};
	util.Set.each(cc, function(aid) {
		var ps = this.atoms.get(aid).a.ps;
		if (bb.min == null) {
			bb.min = bb.max = ps;
		} else {
			bb.min = bb.min.min(ps);
			bb.max = bb.max.max(ps);
		}
	}, this);
	return bb;
};

rnd.ReStruct.prototype.initLayers = function () {
	for (var group in rnd.ReStruct.layerMap)
		this.layers[rnd.ReStruct.layerMap[group]] =
		this.render.paper.rect(0, 0, 10, 10)
		.attr({
			'fill':'#000',
			'opacity':'0.0'
		}).toFront();
};

rnd.ReStruct.prototype.insertInLayer = function (lid, path) {
	path.insertBefore(this.layers[lid]);
};

rnd.ReStruct.prototype.clearMarks = function () {
	this.bondsChanged = {};
	this.atomsChanged = {};
	this.structChanged = false;
};

rnd.ReStruct.prototype.markItemRemoved = function () {
	this.structChanged = true;
};

rnd.ReStruct.prototype.markBond = function (bid, mark) {
	this.markItem('bonds', bid, mark);
};

rnd.ReStruct.prototype.markAtom = function (aid, mark) {
	this.markItem('atoms', aid, mark);
};

rnd.ReStruct.prototype.markItem = function (map, id, mark) {
	var mapChanged = this[map+'Changed'];
	mapChanged[id] = (typeof(mapChanged[id]) != 'undefined') ?
	Math.max(mark, mapChanged[id]) : mark;
	if (this[map].has(id))
		this.clearVisel(this[map].get(id).visel);
};

rnd.ReStruct.prototype.eachVisel = function (func, context) {

	for (var map in rnd.ReStruct.maps) {
		this[map].each(function(id, item){
			func.call(context, item.visel);
		}, this);
	}
	if (this.chiral.p != null)
		func.call(context, this.chiral.visel);
	this.sgroups.each(function(sid, sgroup){
		func.call(context, sgroup.visel);
	}, this);
	this.reloops.each(function(rlid, reloop) {
		func.call(context, reloop.visel);
	}, this);
	for (var i = 0; i < this.tmpVisels.length; ++i)
		func.call(context, this.tmpVisels[i]);
};

rnd.ReStruct.prototype.translate = function (d) {
	this.eachVisel(function(visel){
		this.translateVisel(visel, d);
	}, this);
};

rnd.ReStruct.prototype.scale = function (s) {
	// NOTE: bounding boxes are not valid after scaling
	this.eachVisel(function(visel){
		this.scaleVisel(visel, s);
	}, this);
};

rnd.ReStruct.prototype.translateVisel = function (visel, d) {
	var i;
	for (i = 0; i < visel.paths.length; ++i)
		visel.paths[i].translate(d.x, d.y);
	for (i = 0; i < visel.boxes.length; ++i)
		visel.boxes[i].translate(d);
	if (visel.boundingBox != null)
		visel.boundingBox.translate(d);
};

rnd.ReStruct.prototype.scaleRPath = function (path, s) {
	if (path.type == "set") { // TODO: rework scaling
		for (var i = 0; i < path.length; ++i)
			this.scaleRPath(path[i], s);
	} else {
		if (!Object.isUndefined(path.attrs)) {
			if ('font-size' in path.attrs)
				path.attr('font-size', path.attrs['font-size'] * s);
			else if ('stroke-width' in path.attrs)
				path.attr('stroke-width', path.attrs['stroke-width'] * s);
		}
		path.scale(s, s, 0, 0);
	}
};

rnd.ReStruct.prototype.scaleVisel = function (visel, s) {
	for (var i = 0; i < visel.paths.length; ++i)
		this.scaleRPath(visel.paths[i], s);
};

rnd.ReStruct.prototype.clearVisels = function () {
	this.eachVisel(function(visel){
		this.clearVisel(visel);
	}, this);
};

rnd.ReStruct.prototype.update = function (force)
{
	force = force || !this.initialized;

	// check items to update
	var id;
	if (force) {
		(function(){
			for (var map in rnd.ReStruct.maps) {
				var mapChanged = this[map+'Changed'];
				this[map].each(function(id){
					mapChanged[id] = 1;
				}, this);
			}
		}).call(this);
	} else {
		// check if some of the items marked are already gone
		(function(){
			for (var map in rnd.ReStruct.maps) {
				var mapChanged = this[map+'Changed'];
				for (id in mapChanged)
					if (!this[map].has(id))
						delete mapChanged[id];
			}
		}).call(this);
	}
	for (id in this.atomsChanged)
		this.connectedComponentRemoveAtom(id);

    // clean up empty fragments
    // TODO: fragment removal should be triggered by the action responsible for the fragment contents removal and form an operation of its own
    var emptyFrags = this.frags.findAll(function(fid, frag) {
        return !frag.calcBBox(this.render, fid);
    }, this);
    for (var j = 0; j < emptyFrags.length; ++j) {
        var fid = emptyFrags[j];
        this.clearVisel(this.frags.get(fid).visel);
        this.frags.unset(fid);
        this.molecule.frags.remove(fid);
    }

	(function(){
		for (var map in rnd.ReStruct.maps) {
			var mapChanged = this[map+'Changed'];
			for (id in mapChanged) {
				this.clearVisel(this[map].get(id).visel);
				this.structChanged |= mapChanged[id] > 0;
			}
		}
	}).call(this);

	if (this.chiral.visel != null)
		this.clearVisel(this.chiral.visel);
	// TODO: when to update sgroup?
	this.sgroups.each(function(sid, sgroup){
            this.clearVisel(sgroup.visel);
            sgroup.highlighting = null;
            sgroup.selectionPlate = null;                
	}, this);
	for (var i = 0; i < this.tmpVisels.length; ++i)
		this.clearVisel(this.tmpVisels[i]);
	this.tmpVisels.clear();

    // TODO [RB] need to implement update-on-demand for fragments and r-groups
    this.frags.each(function(frid, frag) {
        this.clearVisel(frag.visel);
    }, this);
    this.rgroups.each(function(rgid, rgroup) {
        this.clearVisel(rgroup.visel);
    }, this);

	if (force) { // clear and recreate all half-bonds
		this.clearConnectedComponents();
		this.molecule.initHalfBonds();
		this.molecule.initNeighbors();
	}

	// only update half-bonds adjacent to atoms that have moved
	this.updateHalfBonds();
	this.sortNeighbors();
	this.assignConnectedComponents();
//	this.printConnectedComponents();
	this.setImplicitHydrogen();
	this.setHydrogenPos();
	this.initialized = true;

	this.scaleCoordinates();
	var updLoops = force || this.structChanged;
	if (updLoops)
		this.updateLoops();
	this.setDoubleBondShift();
	this.checkLabelsToShow();
	this.showLabels();
	this.shiftBonds();
	this.showBonds();
	this.verifyLoops();
	if (updLoops)
		this.renderLoops();
	this.clearMarks();
	this.drawReactionSymbols();
	this.drawSGroups();
    this.drawFragments();
    this.drawRGroups();
	this.drawChiralLabel();

//	this.connectedComponents.each(function(ccid, cc){
//		var min = null;
//		var max = null;
//		util.Set.each(cc, function(aid){
//			var p = this.atoms.get(aid).a.ps;
//			if (min == null) {
//				min = max = p;
//			} else {
//				min = min.min(p);
//				max = max.max(p);
//			}
//		}, this);
//		if (max == null || min == null)
//			return;
//		var sz = max.sub(min);
//		var path = this.render.paper.rect(min.x, min.y, sz.x, sz.y)
//		.attr({
//			'fill':'#999',
//			'stroke':null
//		});
//		this.addTmpPath('background', path);
//	}, this);

	return true;
};

rnd.ReStruct.prototype.drawReactionSymbols = function ()
{
	var item;
    var id;
	for (id in this.rxnArrowsChanged) {
		item = this.rxnArrows.get(id);
		this.drawReactionArrow(id, item);
	}
	for (id in this.rxnPlusesChanged) {
		item = this.rxnPluses.get(id);
		this.drawReactionPlus(id, item);
	}
};

rnd.ReStruct.prototype.drawReactionArrow = function (id, item)
{
	var centre = item.item.ps;
	var path = this.drawArrow(new util.Vec2(centre.x - this.render.scale, centre.y), new util.Vec2(centre.x + this.render.scale, centre.y));
	item.visel.add(path, util.Box2Abs.fromRelBox(path.getBBox()));
	var offset = this.render.offset;
	if (offset != null)
		path.translate(offset.x, offset.y);
	if (item.selected)
		this.showItemSelection(id, item, true);
};

rnd.ReStruct.prototype.drawReactionPlus = function (id, item)
{
	var centre = item.item.ps;
	var path = this.drawPlus(centre);
	item.visel.add(path, util.Box2Abs.fromRelBox(path.getBBox()));
	var offset = this.render.offset;
	if (offset != null)
		path.translate(offset.x, offset.y);
	if (item.selected)
		this.showItemSelection(id, item, true);
};

rnd.ReStruct.prototype.drawSGroups = function ()
{
	this.sgroups.each(function (id, sgroup) {
		var path = sgroup.draw(this.render);
		this.addReObjectPath('data', sgroup.visel, path);
	}, this);
};

rnd.ReStruct.prototype.drawFragments = function() {
    this.frags.each(function(id, frag) {
        var path = frag.draw(this.render, id);
        if (path) this.addReObjectPath('data', frag.visel, path);
        // TODO fragment selection & highlighting
    }, this);
};

rnd.ReStruct.prototype.drawRGroups = function() {
    this.rgroups.each(function(id, rgroup) {
        var drawing = rgroup.draw(this.render);
        for (var group in drawing) {
            while (drawing[group].length > 0) {
                this.addReObjectPath(group, rgroup.visel, drawing[group].shift());
            }
        }
        // TODO rgroup selection & highlighting
    }, this);
};

rnd.ReStruct.prototype.drawChiralLabel = function ()
{
	var render = this.render;
	var paper = render.paper;
	var settings = render.settings;
	if (this.chiral.p != null) {
		if (this.chiral.ps == null) {
			this.chiral.ps = this.chiral.p.scaled(settings.scaleFactor);
		}

		this.chiral.path = paper.text(this.chiral.ps.x, this.chiral.ps.y, "Chiral")
		.attr({
			'font' : settings.font,
			'font-size' : settings.fontsz,
			'fill' : '#000'
		});
		this.addReObjectPath('data', this.chiral.visel, this.chiral.path);
	}
};

rnd.ReStruct.prototype.eachCC = function (func, type, context) {
	this.connectedComponents.each(function(ccid, cc) {
		if (!type || this.ccFragmentType.get(ccid) == type)
			func.call(context || this, ccid, cc);
	}, this);
};

rnd.ReStruct.prototype.getGroupBB = function (type)
{
	var bb = {'min':null, 'max':null};

	this.eachCC(function(ccid, cc) {
		bb = this.connectedComponentGetBoundingBox(ccid, cc, bb);
	}, type, this);

	return bb;
};

rnd.ReStruct.prototype.updateHalfBonds = function () {
	for (var aid in this.atomsChanged) {
		if (this.atomsChanged[aid] < 1)
			continue;
		this.molecule.atomUpdateHalfBonds(aid);
	}
};

rnd.ReStruct.prototype.sortNeighbors = function () {
	// sort neighbor halfbonds in CCW order
	for (var aid in this.atomsChanged) {
		if (this.atomsChanged[aid] < 1)
			continue;
		this.molecule.atomSortNeighbors(aid);
	}
};

rnd.ReStruct.prototype.setHydrogenPos = function () {
	// check where should the hydrogen be put on the left of the label
	for (var aid in this.atomsChanged) {
		var atom = this.atoms.get(aid);

		if (atom.a.neighbors.length == 0) {
			var elem = chem.Element.getElementByLabel(atom.a.label);
			if (elem != null) {
				atom.hydrogenOnTheLeft = chem.Element.elements.get(elem).putHydrogenOnTheLeft;
			}
			continue;
		}
		var yl = 1, yr = 1, nl = 0, nr = 0;
		for (var i = 0; i < atom.a.neighbors.length; ++i) {
			var d = this.molecule.halfBonds.get(atom.a.neighbors[i]).dir;
			if (d.x <= 0) {
				yl = Math.min(yl, Math.abs(d.y));
				nl++;
			} else {
				yr = Math.min(yr, Math.abs(d.y));
				nr++;
			}
		}
		if (yl < 0.51 || yr < 0.51)
			atom.hydrogenOnTheLeft = yr < yl;
		else
			atom.hydrogenOnTheLeft = nr > nl;
	}
};

rnd.ReStruct.prototype.setImplicitHydrogen = function () {
	// calculate implicit hydrogens
	for (var aid in this.atomsChanged) {
		this.molecule.calcImplicitHydrogen(aid);
	}
};

rnd.ReLoop = function (loop)
{
	this.loop = loop;
	this.visel = new rnd.Visel(rnd.Visel.TYPE.LOOP);
	this.centre = new util.Vec2();
	this.radius = new util.Vec2();
};

rnd.ReStruct.prototype.findLoops = function ()
{
	var struct = this.molecule;
	// Starting from each half-bond not known to be in a loop yet,
	//  follow the 'next' links until the initial half-bond is reached or
	//  the length of the sequence exceeds the number of half-bonds available.
	// In a planar graph, as long as every bond is a part of some "loop" -
	//  either an outer or an inner one - every iteration either yields a loop
	//  or doesn't start at all. Thus this has linear complexity in the number
	//  of bonds for planar graphs.
	var j, k, c, loop, loopId;
	struct.halfBonds.each(function (i, hb) {
		if (hb.loop == -1)
		{
			for (j = i, c = 0, loop = [];
				c <= struct.halfBonds.count();
				j = struct.halfBonds.get(j).next, ++c)
				{
				if (c > 0 && j == i) {
					var totalAngle = 2 * Math.PI;
					var convex = true;
					for (k = 0; k < loop.length; ++k)
					{
						var hba = struct.halfBonds.get(loop[k]);
						var hbb = struct.halfBonds.get(loop[(k + 1) % loop.length]);
						var angle = Math.atan2(
								util.Vec2.cross(hba.dir, hbb.dir),
								util.Vec2.dot(hba.dir, hbb.dir));
						if (angle > 0)
							convex = false;
						if (hbb.contra == loop[k]) // back and force one edge
							totalAngle += Math.PI;
						else
							totalAngle += angle;
					}
					if (Math.abs(totalAngle) < Math.PI) // loop is internal
						loopId = struct.loops.add(new chem.Loop(loop, struct, convex));
					else
						loopId = -2;
					loop.each(function(hbid){
						struct.halfBonds.get(hbid).loop = loopId;
						this.markBond(struct.halfBonds.get(hbid).bid, 1);
					}, this);
					if (loopId >= 0)
						this.reloops.set(loopId, new rnd.ReLoop(struct.loops.get(loopId)));
					break;
				} else {
					loop.push(j);
				}
			}
		}
	}, this);
};

rnd.ReStruct.prototype.coordProcess = function ()
{
	this.molecule.coordProject();
	var bb = this.molecule.getCoordBoundingBox();
	var avg = this.molecule.getAvgBondLength();
	if (avg < 0 && !this.molecule.isReaction) // TODO [MK] this doesn't work well for reactions as the distances between
		// the atoms in different components are generally larger than those between atoms of a single component
		// (KETCHER-341)
		avg = this.molecule.getAvgClosestAtomDistance();
	if (avg < 1e-3)
		avg = 1;
	var scale = 1 / avg;

	if (this.molecule.isChiral)
		this.chiral.p = new util.Vec2((bb.max.x - bb.min.x) * scale, -(bb.max.y - bb.min.y) * scale - 1);
	this.molecule.coordShiftFlipScale(bb.min, scale, bb.max.y - bb.min.y);
};

rnd.ReStruct.prototype.scaleCoordinates = function()
{
	var settings = this.render.settings;
	var scale = function (item) {
		item.ps = item.pp.scaled(settings.scaleFactor);
	};
    var id;
	for (id in this.atomsChanged) {
		scale(this.atoms.get(id).a);
	}
	for (id in this.rxnArrowsChanged) {
		scale(this.rxnArrows.get(id).item);
	}
	for (id in this.rxnPlusesChanged) {
		scale(this.rxnPluses.get(id).item);
	}
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.atomAdd = function (pos, params)
{
	var pp = {};
	if (params)
		for (var p in params)
			pp[p] = params[p];
	pp.label = pp.label || 'C';
	var aid = this.molecule.atoms.add(new chem.Struct.Atom(pp));
    var atomData = new rnd.ReAtom(this.molecule.atoms.get(aid));
	atomData.component = this.connectedComponents.add(util.Set.single(aid));
	this.atoms.set(aid, atomData);
	this.molecule._atomSetPos(aid, pos);
	return aid;
};

rnd.ReStruct.prototype._atomApplySgs = function (aid, sgs) {
    util.Set.each(sgs, function(id) {
        chem.SGroup.addAtom(this.sgroups.get(id).item, aid);
    }, this);
}

rnd.ReStruct.prototype.notifyAtomAdded = function(aid) {
    var atomData = new rnd.ReAtom(this.molecule.atoms.get(aid));
    atomData.component = this.connectedComponents.add(util.Set.single(aid));
    this.atoms.set(aid, atomData);
    this.markAtom(aid, 1);
    if (atomData.a.sgs)
        this._atomApplySgs(aid, atomData.a.sgs);
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.rxnPlusAdd = function (pos, params)
{
	var id = this.molecule.rxnPluses.add(new chem.Struct.RxnPlus());
	var reItem = new rnd.ReRxnPlus(this.molecule.rxnPluses.get(id));
	this.rxnPluses.set(id, reItem);
	this.molecule._rxnPlusSetPos(id, pos);
	return id;
};

rnd.ReStruct.prototype.notifyRxnPlusAdded = function(plid) {
    this.rxnPluses.set(plid, new rnd.ReRxnPlus(this.molecule.rxnPluses.get(plid)));
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.rxnArrowAdd = function (pos, params)
{
	var id = this.molecule.rxnArrows.add(new chem.Struct.RxnArrow());
	var reItem = new rnd.ReRxnArrow(this.molecule.rxnArrows.get(id));
	this.rxnArrows.set(id, reItem);
	this.molecule._rxnArrowSetPos(id, pos);
	return id;
};

rnd.ReStruct.prototype.notifyRxnArrowAdded = function(arid) {
    this.rxnArrows.set(arid, new rnd.ReRxnArrow(this.molecule.rxnArrows.get(arid)));
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.rxnArrowRemove = function (id)
{
	var reitem = this.rxnArrows.get(id);
	this.markItemRemoved();
	this.clearVisel(reitem.visel);
	this.rxnArrows.unset(id);
	this.molecule.rxnArrows.remove(id);
};

rnd.ReStruct.prototype.notifyRxnArrowRemoved = function(arid) {
    this.markItemRemoved();
    this.clearVisel(this.rxnArrows.get(arid).visel);
    this.rxnArrows.unset(arid);
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.rxnPlusRemove = function (id)
{
	var reitem = this.rxnPluses.get(id);
	this.markItemRemoved();
	this.clearVisel(reitem.visel);
	this.rxnPluses.unset(id);
	this.molecule.rxnPluses.remove(id);
};

rnd.ReStruct.prototype.notifyRxnPlusRemoved = function(plid) {
    this.markItemRemoved();
    this.clearVisel(this.rxnPluses.get(plid).visel);
    this.rxnPluses.unset(plid);
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.bondAdd = function (begin, end, params)
{
	if (begin == end) {
		debugger;
		throw new Error("Distinct atoms expected");
	}
	if (rnd.DEBUG && this.molecule.checkBondExists(begin, end))
		throw new Error("Bond already exists");
	var pp = {};
	if (params)
		for (var p in params)
			pp[p] = params[p];

	pp.type = pp.type || chem.Struct.BOND.TYPE.SINGLE;
	pp.begin = begin;
	pp.end = end;

	var bid = this.molecule.bonds.add(new chem.Struct.Bond(pp));
    this.bonds.set(bid, new rnd.ReBond(this.molecule.bonds.get(bid)));
	this.molecule.bondInitHalfBonds(bid);
	this.molecule.atomAddNeighbor(this.bonds.get(bid).b.hb1);
	this.molecule.atomAddNeighbor(this.bonds.get(bid).b.hb2);
	return bid;
};

rnd.ReStruct.prototype.notifyBondAdded = function(bid) {
    this.bonds.set(bid, new rnd.ReBond(this.molecule.bonds.get(bid)));
    this.markBond(bid, 1);
};

rnd.ReStruct.prototype.bondFlip = function (bid)
{
	var data = this.bonds.get(bid).b;
	this.bondRemove(bid);
	return this.bondAdd(data.end, data.begin, data);
};

/** @deprecated old architecture */
rnd.ReStruct.prototype.atomRemove = function (aid)
{
	var atom = this.atoms.get(aid);
	var set = this.connectedComponents.get(atom.component);
	util.Set.remove(set, aid);
	if (util.Set.size(set) == 0) {
		this.connectedComponents.remove(atom.component);
	}

	// clone neighbors array, as it will be modified
	var neiHb = Array.from(atom.a.neighbors);
	neiHb.each(function(hbid){
		var hb = this.molecule.halfBonds.get(hbid);
		this.bondRemove(hb.bid);
	},this);
	this.markItemRemoved();
	this.clearVisel(atom.visel);
	this.atoms.unset(aid);
	this.molecule.atoms.remove(aid);
};

rnd.ReStruct.prototype.notifyAtomRemoved = function (aid) {
    var atom = this.atoms.get(aid);
    var set = this.connectedComponents.get(atom.component);
    util.Set.remove(set, aid);
    if (util.Set.size(set) == 0) {
        this.connectedComponents.remove(atom.component);
    }
	this.clearVisel(atom.visel);
	this.atoms.unset(aid);
    this.markItemRemoved();
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.bondRemove = function (bid)
{
	var bond = this.bonds.get(bid);
	this.halfBondUnref(bond.b.hb1);
	this.halfBondUnref(bond.b.hb2);
	this.molecule.halfBonds.unset(bond.b.hb1);
	this.molecule.halfBonds.unset(bond.b.hb2);
	this.markItemRemoved();
	this.clearVisel(bond.visel);
	this.bonds.unset(bid);
	this.molecule.bonds.remove(bid);
};

rnd.ReStruct.prototype.notifyBondRemoved = function(bid) {
    var bond = this.bonds.get(bid);
    [bond.b.hb1, bond.b.hb2].each(function(hbid) {
        var hb = this.molecule.halfBonds.get(hbid);
        if (hb.loop >= 0)
            this.loopRemove(hb.loop);
    }, this);
    this.clearVisel(bond.visel);
    this.bonds.unset(bid);
    this.markItemRemoved();
};

rnd.ReStruct.prototype.loopRemove = function (loopId)
{
	if (!this.reloops.has(loopId))
		return;
	var reloop = this.reloops.get(loopId);
	this.clearVisel(reloop.visel);
	var bondlist = [];
	for (var i = 0; i < reloop.loop.hbs.length; ++i) {
		var hbid = reloop.loop.hbs[i];
		if (!this.molecule.halfBonds.has(hbid))
			continue;
		var hb = this.molecule.halfBonds.get(hbid);
		hb.loop = -1;
		this.markBond(hb.bid, 1);
		this.markAtom(hb.begin, 1);
		bondlist.push(hb.bid);
	}
	this.reloops.unset(loopId);
	this.molecule.loops.remove(loopId);
};

rnd.ReStruct.prototype.loopIsValid = function (rlid, reloop) {
	var loop = reloop.loop;
	var bad = false;
	loop.hbs.each(function(hbid){
		if (!this.molecule.halfBonds.has(hbid)) {
			bad = true;
		}
	}, this);
	return !bad;
};

rnd.ReStruct.prototype.verifyLoops = function ()
{
	var toRemove = [];
	this.reloops.each(function(rlid, reloop){
		if (!this.loopIsValid(rlid, reloop)) {
			toRemove.push(rlid);
		}
	}, this);
	for (var i = 0; i < toRemove.length; ++i) {
		this.loopRemove(toRemove[i]);
	}
};

/** @deprecated [RB] old architecture */
rnd.ReStruct.prototype.halfBondUnref = function (hbid)
{
	var hb = this.molecule.halfBonds.get(hbid);
	var atom = this.atoms.get(hb.begin);
	if (hb.loop >= 0)
		this.loopRemove(hb.loop);

	var pos = atom.a.neighbors.indexOf(hbid);
	var prev = (pos + atom.a.neighbors.length - 1) % atom.a.neighbors.length;
	var next = (pos + 1) % atom.a.neighbors.length;
	this.molecule.setHbNext(atom.a.neighbors[prev], atom.a.neighbors[next]);
	atom.a.neighbors.splice(pos, 1);
};

rnd.ReStruct.prototype.BFS = function (onAtom, orig, context) {
	orig = orig-0;
	var queue = new Array();
	var mask = {};
	queue.push(orig);
	mask[orig] = 1;
	while (queue.length > 0) {
		var aid = queue.shift();
		onAtom.call(context, aid);
		var atom = this.atoms.get(aid);
		for (var i = 0; i < atom.a.neighbors.length; ++i) {
			var nei = atom.a.neighbors[i];
			var hb = this.molecule.halfBonds.get(nei);
			if (!mask[hb.end]) {
				mask[hb.end] = 1;
				queue.push(hb.end);
			}
		}
	}
};

rnd.ReStruct.prototype.sGroupDelete = function (sgid)
{
	var sg = this.sgroups.get(sgid).item;
	var atoms = [];
	for (var i = 0; i < sg.atoms.length; ++i) {
		var aid = sg.atoms[i];
		util.Set.remove(this.atoms.get(aid).a.sgs, sgid);
		atoms.push(aid);
	}
	this.sgroups.unset(sgid);
	this.molecule.sgroups.remove(sgid);
	return atoms;
};

rnd.ReRxnPlus = function (/*chem.RxnPlus*/plus)
{
    this.init(rnd.Visel.TYPE.PLUS);

	this.item = plus;
};
rnd.ReRxnPlus.prototype = new rnd.ReObject();

rnd.ReRxnPlus.findClosest = function (render, p) {
    var minDist;
    var ret;

    render.ctab.rxnPluses.each(function(id, plus) {
        var pos = plus.item.pp;
        var dist = Math.max(Math.abs(p.x - pos.x), Math.abs(p.y - pos.y));
        if (dist < 0.5 && (!ret || dist < minDist)) {
            minDist = dist;
            ret = {'id' : id, 'minDist' : minDist};
        }
    });
    return ret;
}

rnd.ReRxnPlus.prototype.highlightPath = function(render) {
    var p = this.item.ps;
    var s = render.settings.scaleFactor;
    return render.paper.rect(p.x - s/4, p.y - s/4, s/2, s/2, s/8);
}

rnd.ReRxnPlus.prototype.drawHighlight = function(render) {
    var ret = this.highlightPath(render).attr(render.styles.highlightStyle);
    render.addItemPath(this.visel, 'highlighting', ret);
    return ret;
};

rnd.ReRxnPlus.prototype.makeSelectionPlate = function (restruct, paper, styles) { // TODO [MK] review parameters
    return this.highlightPath(restruct.render).attr(styles.selectionStyle);
};

rnd.ReRxnArrow = function (/*chem.RxnArrow*/arrow)
{
    this.init(rnd.Visel.TYPE.ARROW);

    this.item = arrow;
};
rnd.ReRxnArrow.prototype = new rnd.ReObject();

rnd.ReRxnArrow.findClosest = function(render, p) {
    var minDist;
    var ret;

    render.ctab.rxnArrows.each(function(id, arrow) {
        var pos = arrow.item.pp;
        if (Math.abs(p.x - pos.x) < 1.0) {
            var dist = Math.abs(p.y - pos.y);
            if (dist < 0.3 && (!ret || dist < minDist)) {
                minDist = dist;
                ret = {'id' : id, 'minDist' : minDist};
            }
        }
    });
    return ret;
};

rnd.ReRxnArrow.prototype.highlightPath = function(render) {
    var p = this.item.ps;
    var s = render.settings.scaleFactor;
    return render.paper.rect(p.x - s, p.y - s/4, 2*s, s/2, s/8);
}

rnd.ReRxnArrow.prototype.drawHighlight = function(render) {
    var ret = this.highlightPath(render).attr(render.styles.highlightStyle);
    render.addItemPath(this.visel, 'highlighting', ret);
    return ret;
};

rnd.ReRxnArrow.prototype.makeSelectionPlate = function (restruct, paper, styles) {
    return this.highlightPath(restruct.render).attr(styles.selectionStyle);
};

rnd.ReFrag = function(/*chem.Struct.Fragment*/frag) {
    this.init(rnd.Visel.TYPE.FRAGMENT);

    this.item = frag;
};
rnd.ReFrag.prototype = new rnd.ReObject();

rnd.ReFrag.findClosest = function(render, p, skip, minDist) {
    minDist = Math.min(minDist || render.opt.selectionDistanceCoefficient, render.opt.selectionDistanceCoefficient);
    var ret;
    render.ctab.frags.each(function(fid, frag) {
        if (fid != skip) {
            var bb = frag.calcBBox(render, fid); // TODO any faster way to obtain bb?
            if (bb.p0.y < p.y && bb.p1.y > p.y && bb.p0.x < p.x && bb.p1.x > p.x) {
                var xDist = Math.min(Math.abs(bb.p0.x - p.x), Math.abs(bb.p1.x - p.x));
                if (!ret || xDist < minDist) {
                    minDist = xDist;
                    ret = { 'id' : fid, 'minDist' : minDist };
                }
            }
        }
    });
    return ret;
};

rnd.ReFrag.prototype.fragGetAtoms = function(render, fid) {
    var ret = [];
    render.ctab.atoms.each(function(aid, atom) {
        if (atom.a.fragment == fid) {
            ret.push(aid);
        }
    }, this);
    return ret;
};

rnd.ReFrag.prototype.fragGetBonds = function(render, fid) {
    var ret = [];
    render.ctab.bonds.each(function(bid, bond) {
        if (render.ctab.atoms.get(bond.b.begin).a.fragment == fid &&
            render.ctab.atoms.get(bond.b.end).a.fragment == fid) {
            ret.push(bid);
        }
    }, this);
    return ret;
};

rnd.ReFrag.prototype.calcBBox = function(render, fid) { // TODO need to review parameter list
    var ret;
    render.ctab.atoms.each(function(aid, atom) {
        if (atom.a.fragment == fid) {
            // TODO ReObject.calcBBox to be used instead
            var bba = atom.visel.boundingBox;
            if (!bba) {
                bba = new util.Box2Abs(atom.a.pp, atom.a.pp);
                var ext = new util.Vec2(0.05 * 3, 0.05 * 3);
                bba = bba.extend(ext, ext);
            } else {
                bba = bba.transform(render.scaled2obj, render);
            }
            ret = (ret ? util.Box2Abs.union(ret, bba) : bba);
        }
    }, this);
    return ret;
};

rnd.ReFrag.prototype._draw = function(render, fid, attrs) { // TODO need to review parameter list
    var bb = this.calcBBox(render, fid);
    if (bb) {
        var p0 = render.obj2scaled(new util.Vec2(bb.p0.x, bb.p0.y));
        var p1 = render.obj2scaled(new util.Vec2(bb.p1.x, bb.p1.y));
        return render.paper.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, 0).attr(attrs);
    } else {
        // TODO abnormal situation, empty fragments must be destroyed by tools
    }
};

rnd.ReFrag.prototype.draw = function(render, fid) { // TODO need to review parameter list
    return null;//this._draw(render, fid, { 'stroke' : 'lightgray' }); // [RB] for debugging only
};

rnd.ReFrag.prototype.drawHighlight = function(render) { // TODO need to review parameter list
    var fid = render.ctab.frags.keyOf(this);
    if (!Object.isUndefined(fid)) {
        var ret = this._draw(render, fid, render.styles.highlightStyle/*{ 'fill' : 'red' }*/);
        render.addItemPath(this.visel, 'highlighting', ret);
        return ret;
    } else {
        // TODO abnormal situation, fragment does not belong to the render
    }
};

rnd.ReRGroup = function(/*chem.Struct.RGroup*/rgroup) {
    this.init(rnd.Visel.TYPE.RGROUP);

    this.item = rgroup;
};
rnd.ReRGroup.prototype = new rnd.ReObject();

rnd.ReRGroup.findClosest = function(render, p, skip, minDist) {
    minDist = Math.min(minDist || render.opt.selectionDistanceCoefficient, render.opt.selectionDistanceCoefficient);
    var ret;
    render.ctab.rgroups.each(function(rgid, rgroup) {
        if (rgid != skip) {
            var bb = rgroup.calcVBox(render);
            if (bb.p0.y < p.y && bb.p1.y > p.y && bb.p0.x < p.x && bb.p1.x > p.x) {
                var xDist = Math.min(Math.abs(bb.p0.x - p.x), Math.abs(bb.p1.x - p.x));
                if (!ret || xDist < minDist) {
                    minDist = xDist;
                    ret = { 'id' : rgid, 'minDist' : minDist };
                }
            }
        }
    });
    return ret;
};

rnd.ReRGroup.prototype.calcBBox = function(render) {
    var ret;
    this.item.frags.each(function(fnum, fid) {
        var bbf = render.ctab.frags.get(fid).calcBBox(render, fid);
        if (bbf) {
            ret = (ret ? util.Box2Abs.union(ret, bbf) : bbf);
        }
    });
    ret = ret.extend(this.__ext, this.__ext);
    return ret;
};

rnd.ReRGroup.prototype.draw = function(render) { // TODO need to review parameter list
    var bb = this.calcBBox(render);
    var settings = render.settings;
    if (bb) {
        var ret = { 'data' : [] };
        var p0 = render.obj2scaled(new util.Vec2(bb.p0.x, bb.p0.y));
        var p1 = render.obj2scaled(new util.Vec2(bb.p1.x, bb.p1.y));
        var brackets = render.paper.set();
        chem.SGroup.drawBrackets(brackets, render, render.paper, settings, render.styles, bb);
        ret.data.push(brackets);
        var key = render.ctab.rgroups.keyOf(this);
        var label = render.paper.text(p0.x, (p0.y + p1.y)/2, 'R' + key + '=')
            .attr({
				'font' : settings.font,
				'font-size' : settings.fontRLabel,
				'fill' : 'black'
			});
        var labelBox = label.getBBox();
        label.translate(-labelBox.width/2-settings.lineWidth, 0);
        var logicStyle = {
				'font' : settings.font,
				'font-size' : settings.fontRLogic,
				'fill' : 'black'
			};

        var logic = [];
        // TODO [RB] temporary solution, need to review
        //BEGIN
/*
        if (this.item.range.length > 0)
            logic.push(this.item.range);
        if (this.item.resth)
            logic.push("RestH");
        if (this.item.ifthen > 0)
            logic.push("IF R" + key.toString() + " THEN R" + this.item.ifthen.toString());
*/
        logic.push(
            (this.item.ifthen > 0 ? 'IF ' : '')
            + 'R' + key.toString()
            + (this.item.range.length > 0
                ? this.item.range.startsWith('>') || this.item.range.startsWith('<') || this.item.range.startsWith('=')
                    ? this.item.range
                    : '=' + this.item.range
                : '>0')
            + (this.item.resth ? ' (RestH)' : '')
            + (this.item.ifthen > 0 ? '\nTHEN R' + this.item.ifthen.toString() : '')
        );
        //END
        var shift = labelBox.height/2 + settings.lineWidth/2;
        for (var i = 0; i < logic.length; ++i) {
            var logicPath = render.paper.text(p0.x, (p0.y + p1.y)/2, logic[i]).attr(logicStyle);
            var logicBox = logicPath.getBBox();
            shift += logicBox.height/2;
            logicPath.translate(-logicBox.width/2-6*settings.lineWidth, shift);
            shift += logicBox.height/2 + settings.lineWidth/2;
            ret.data.push(logicPath);
        }
        ret.data.push(label);
        return ret;
    } else {
        // TODO abnormal situation, empty fragments must be destroyed by tools
        return {};
    }
};

rnd.ReRGroup.prototype._draw = function(render, rgid, attrs) { // TODO need to review parameter list
    var bb = this.calcVBox(render).extend(this.__ext, this.__ext);
    if (bb) {
        var p0 = render.obj2scaled(new util.Vec2(bb.p0.x, bb.p0.y));
        var p1 = render.obj2scaled(new util.Vec2(bb.p1.x, bb.p1.y));
        return render.paper.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, 0).attr(attrs);
    }
};

rnd.ReRGroup.prototype.drawHighlight = function(render) { // TODO need to review parameter list
    var rgid = render.ctab.rgroups.keyOf(this);
    if (!Object.isUndefined(rgid)) {
        var ret = this._draw(render, rgid, render.styles.highlightStyle/*{ 'fill' : 'red' }*/);
        render.addItemPath(this.visel, 'highlighting', ret);
        return ret;
    } else {
        // TODO abnormal situation, fragment does not belong to the render
    }
};

rnd.ReSGroup = function(sgroup) {
    this.init(rnd.Visel.TYPE.SGROUP);

    this.item = sgroup;
};
rnd.ReSGroup.prototype = new rnd.ReObject();

rnd.ReSGroup.findClosest = function(render, p) {
	var ret = null;
	var minDist = render.opt.selectionDistanceCoefficient;
    render.ctab.molecule.sgroups.each(function(sgid, sg){
        var d = sg.bracketDir, n = d.rotateSC(1, 0);
        var pg = new util.Vec2(util.Vec2.dot(p, d), util.Vec2.dot(p, n));
        for (var i = 0; i < sg.areas.length; ++i) {
            var box = sg.areas[i];
            var inBox = box.p0.y < pg.y && box.p1.y > pg.y && box.p0.x < pg.x && box.p1.x > pg.x;
            var xDist = Math.min(Math.abs(box.p0.x - pg.x), Math.abs(box.p1.x - pg.x));
            if (inBox && (ret == null || xDist < minDist)) {
                ret = sgid;
                minDist = xDist;
            }
        }
	}, this);
	if (ret != null)
		return {
			'id':ret,
			'dist':minDist
		};
	return null;
};

rnd.ReSGroup.prototype.draw = function(render) { // TODO need to review parameter list
    return this.item.draw(render.ctab);
};

rnd.ReSGroup.prototype.drawHighlight = function(render) {
    var styles = render.styles;
    var settings = render.settings;
    var paper = render.paper;
    var sg = this.item;
    var bb = sg.bracketBox.transform(render.obj2scaled, render);
    var lw = settings.lineWidth;
    var vext = new util.Vec2(lw * 4, lw * 6);
    bb = bb.extend(vext, vext);
    var d = sg.bracketDir, n = d.rotateSC(1,0);
    var a0 = util.Vec2.lc2(d, bb.p0.x, n, bb.p0.y);
    var a1 = util.Vec2.lc2(d, bb.p0.x, n, bb.p1.y);
    var b0 = util.Vec2.lc2(d, bb.p1.x, n, bb.p0.y);
    var b1 = util.Vec2.lc2(d, bb.p1.x, n, bb.p1.y);

    var set = paper.set();
    sg.highlighting = paper
        .path("M{0},{1}L{2},{3}L{4},{5}L{6},{7}L{0},{1}", a0.x, a0.y, a1.x, a1.y, b1.x, b1.y, b0.x, b0.y)
        .attr(styles.highlightStyle);
    set.push(sg.highlighting);
    render.ctab.addReObjectPath('highlighting', this.visel, sg.highlighting);

    var atoms = chem.SGroup.getAtoms(render.ctab.molecule, sg);

    atoms.each(function (id)
    {
        var atom = render.ctab.atoms.get(id);
        atom.sGroupHighlighting = paper
        .circle(atom.a.ps.x, atom.a.ps.y, 0.7 * styles.atomSelectionPlateRadius)
        .attr(styles.sGroupHighlightStyle);
        set.push(atom.sGroupHighlighting);
        render.ctab.addReObjectPath('highlighting', this.visel, atom.sGroupHighlighting);
    }, this);
    return set;
};

(function(red) {
var cjs = red.cjs, _ = red._;

var Antenna = function(paper, options) {
	this.options = _.extend({
		radius: 5
		, height: 40
		, top: 5
		, left: 10
		, animation_duration: 600
		, animate_creation: false
	}, options);


	if(this.options.animate_creation) {
		this.expanded = false;
		this.ellipse = paper.ellipse(this.options.left
									, this.options.top + this.options.height
									, 0
									, 0);
		this.line = paper.path("M" + this.options.left + "," + (this.options.top+this.options.height));
		this.expand();
	} else {
		this.expanded = true;
		this.ellipse = paper.ellipse(this.options.left
									, this.options.top + this.options.radius
									, this.options.radius
									, this.options.radius);
		this.line = paper.path("M"+this.options.left+","+(this.options.top+2*this.options.radius)+
								"L"+this.options.left+","+(this.options.top + this.options.height));
	}
};

(function(my) {
	var proto = my.prototype;

	proto.collapse = function(callback) {
		this.line.animate({
			path: "M" + this.options.left + "," + (this.options.top+this.options.height)
		}, this.options.animation_duration);
		this.ellipse.animate({
			cy: this.options.top + this.options.height
			, ry: 0
			, rx: 0
		}, this.options.animation_duration, "<>", callback);
		this.expanded = false;
	};
	proto.expand = function() {
		this.expanded = true;
		this.line.animate({
			path: "M"+this.options.left+","+(this.options.top+2*this.options.radius)+
							"L"+this.options.left+","+(this.options.top + this.options.height)
		}, this.options.animation_duration);
		this.ellipse.animate({
			cy: this.options.top + this.options.radius
			, ry: this.options.radius
			, rx: this.options.radius
		}, this.options.animation_duration);
	};
	proto.option = function(key, value, animated) {
		if(arguments.length <= 1) {
			return this.options[key];
		} else {
			this.options[key] = value;
			var animation_duration = animated ? this.options.animation_duration : 0;
			if(this.expanded) {
				this.ellipse.animate({
					cy: this.options.top + this.options.radius
					, cx: this.options.left
					, ry: this.options.radius
					, rx: this.options.radius
				}, animation_duration);
				this.line.animate({
					path: "M"+this.options.left+","+(this.options.top+2*this.options.radius)+
									"L"+this.options.left+","+(this.options.top + this.options.height)
				}, animation_duration);
			} else {
				if(key === "left") {
					this.line.animate({
						path: "M"+this.options.left+","+(this.options.top+2*this.options.radius)+
										"L"+this.options.left+","+(this.options.top + this.options.height)
					}, 0);
					this.ellipse.animate({
						cy: this.options.top + this.options.radius
						, cx: this.options.left
						, ry: this.options.radius
						, rx: this.options.radius
					}, 0);
				}
			}
			return this;
		}
	};
	proto.remove = function (animated) {
		if(animated) {
			var self = this;
			this.collapse(function() {
				self.ellipse.remove();
				self.line.remove();
			});
		} else {
			this.ellipse.remove();
			this.line.remove();
		}
	};
}(Antenna));
red.define("antenna", function(a, b) { return new Antenna(a,b); });

var simple_map = function() {
	var keys = [];
	var values = [];
	return {
		set: function(key, value) {
			var key_index = _.indexOf(keys, key);
			if(key_index < 0) {
				keys.push(key);
				values.push(value);
			} else {
				values[key_index] = value;
			}
		}
		, unset: function(key) {
			var key_index = _.indexOf(keys, key);
			while(key_index >= 0) {
				keys.splice(key_index, 1);
				values.splice(key_index, 1);
				key_index = _.indexOf(keys, key);
			}
			
		}
		, get: function(key) {
			var key_index = _.indexOf(keys, key);
			if(key_index >= 0) {
				return values[key_index];
			}
		}
		, each: function(callback, context) {
			context = context || this;
			for(var i = 0; i<keys.length; i++) {
				var key = keys[i], value = values[i];
				callback.call(context, value, key, i);
			}
		}
	};
};

var TransitionLayoutManager = function(root_view) {
	this.root_view = root_view;
	this.root = this.root_view.statechart;

	this.transition_views = [];
	this.transition_rows = [];
};

(function(my) {
	var proto = my.prototype;
	proto.add_transition_view = function(transition_view) {
		this.transition_views.push(transition_view);
		return this;
	};

	proto.update_layout = function() {
		this.transition_rows = this.compute_transition_rows();
		var transition_positions = simple_map();
		for(var i = 0; i<this.transition_rows.length; i++) {
			var transition_row = this.transition_rows[i];
			for(var j = 0; j<transition_row.length; j++) {
				var transition = transition_row[j];
				if(transition !== false) {
					transition_positions.set(transition, i);
				}
			}
		}
		var base_diameter = this.root_view.option("antenna_top_radius")*2 + this.root_view.option("transition_radius");
		var row_height = this.root_view.option("transition_height");
		transition_positions.each(function(inverse_row, transition_view) {
			var row = this.transition_rows.length - inverse_row - 1;
			
			transition_view.option("y", base_diameter+row * row_height, true);
		}, this);
		return this;
	};

	proto.compute_transition_rows = function() {
		var transitions = _.pluck(this.transition_views, "transition");
		var rows = [];
		var states = this.root.flatten_substates();

		var curr_row = null;
		_.each(transitions, function(transition, index) {
			var from_index = _.indexOf(states, transition.from());
			var to_index = _.indexOf(states, transition.to());

			var min_index = Math.min(from_index, to_index);
			var max_index = Math.max(from_index, to_index);

			if(curr_row === null) {
				curr_row = _.map(states, function() { return false; });
				rows.push(curr_row);
			} else {
				var need_new_row = false;
				for(var i = min_index; i<=max_index; i++) {
					if(curr_row[i]) {
						need_new_row = true;
						break;
					}
				}
				if(need_new_row) {
					curr_row = _.map(states, function() { return false; });
					rows.push(curr_row);
				}
			}

			for(var i = min_index; i<=max_index; i++) {
				curr_row[i] = this.transition_views[index];
			}
		}, this);

		return rows;

	};
}(TransitionLayoutManager));

var statechart_view_map = simple_map();

var StatechartView = function(statechart, paper, options) {
	this.statechart = statechart;
	statechart_view_map.set(this.statechart, this);
	this.paper = paper;
	this.options = _.extend({
						root: false
						, parent: null
						, left: 0
						, width: 100
						, state_name: ""
						, height: 50
						, transition_layout_manager: null
						, antenna_top_radius: 5
						, transition_height: 10
						, top: 0
						, transition_radius: 3
					}, options);


	if(this.options.root) {
		this.options.transition_layout_manager = new TransitionLayoutManager(this);
	} else {
		this.label = red.create("editable_text", this.paper, {
			x: this.option("left") + this.option("width")/2
			, y: 50
			, text: this.option("state_name")
			, text_anchor: "middle"
			, width: this.option("width")
		});
		this.$onRenameRequested = _.bind(this.onRenameRequested, this);
		this.label.on("change", this.$onRenameRequested);
		var bbox = this.label.getBBox();
		var height = bbox.height;
		this.antenna = red.create("antenna", this.paper, { left: this.option("left") + (this.option("width") / 2)
															, height: this.option("height") - bbox.height
															, animate_creation: true
															, radius: this.option("antenna_top_radius")
															, top: this.option("top")
															});
	}

	this.substate_views = [];
	this.transition_views = [];

	this.$substates = this.statechart.$substates;
	this.$outgoing_transitions = this.statechart.$outgoing_transitions;

	this.$onSet = _.bind(this.onSet, this);
	this.$onUnset = _.bind(this.onUnset, this);
	this.$onIndexChange = _.bind(this.onIndexChange, this);
	this.$onMove = _.bind(this.onMove, this);
	this.$onValueChange = _.bind(this.onValueChange, this);
	this.$onKeyChange = _.bind(this.onKeyChange, this);

	this.$substates.each(function(a,b,c) {
		this.$onSet(a,b,c,false);
	}, this);

	this.$substates.onSet(this.$onSet);
	this.$substates.onUnset(this.$onUnset);
	this.$substates.onIndexChange(this.$onIndexChange);
	this.$substates.onMove(this.$onMove);
	this.$substates.onKeyChange(this.$onKeyChange);
	this.$substates.onValueChange(this.$onValueChange)

	if(this.options.root) {
		this.onStatesReady();
	}
};

(function(my) {
	var proto = my.prototype;
	proto.onStatesReady = function() {
		this.$onTransitionAdded = _.bind(this.onTransitionAdded, this);
		this.$onTransitionRemoved = _.bind(this.onTransitionRemoved, this);
		this.$onTransitionMoved = _.bind(this.onTransitionMoved, this);

		this.$outgoing_transitions.each(this.$onTransitionAdded);

		this.$outgoing_transitions.onAdd(this.$onTransitionAdded);
		this.$outgoing_transitions.onRemove(this.$onTransitionRemoved);
		this.$outgoing_transitions.onMove(this.$onTransitionMoved);

		this.$substates.each(function(substate) {
			var view = statechart_view_map.get(substate);
			view.onStatesReady();
		});
	};
	proto.onTransitionAdded = function(transition, index) {
		var to = transition.to();
		var to_view = statechart_view_map.get(to);
		var transition_view = red.create("transition", transition, this.paper, {
			from_view: this
			, to_view: to_view
			, animate_creation: true
		});
		this.transition_views.splice(index, 0, transition_view);

		var transition_layout_manager = this.option("transition_layout_manager");
		transition_layout_manager	.add_transition_view(transition_view)
									.update_layout();
	};
	proto.onTransitionRemoved = function() {
		console.log("removed", arguments);
	};
	proto.onTransitionMoved = function() {
		console.log("moved", arguments);
	};

	proto.onSet = function(state, state_name, index, also_initialize) {
		var state_view = red.create("statechart_view", state, this.paper, {
			parent: this
			, left: this.options.left + this.option("width")*index
			, width: this.options.width
			, state_name: state_name
			, height: this.options.height
			, transition_layout_manager: this.options.transition_layout_manager
		});
		this.substate_views.splice(index, 0, state_view);
		//console.log("set", arguments);
		if(also_initialize !== false) {
			state_view.onStatesReady();
		}
	};
	proto.onUnset = function(state, state_name, index) {
		var substate_view = this.substate_views[index];
		this.substate_views.splice(index, 1);
		substate_view.remove(true);
		//console.log("unset", arguments);
	};
	proto.onIndexChange = function(state, state_name, to_index, from_index) {
		var substate_view = this.substate_views[from_index];
		substate_view.option("left", this.options.left + this.option("width")*to_index, true);
		//console.log("index change", arguments);
	};
	proto.onMove = function(state, state_name, insert_at, to_index, from_index) {
		var substate_view = this.substate_views[from_index];
		this.substate_views.splice(from_index, 1);
		this.substate_views.splice(insert_at, 0, substate_view);
		//console.log("move", arguments);
	};
	proto.onValueChange = function(state, state_name, old_state, index) {
	/*
		var substate_view = this.substate_views[index];
		substate_view.remove(true);
		var new_substate_view = red.create("statechart_view", state, this.paper, {
			parent: this
			, left: this.options.left + this.option("width")*index
			, width: this.options.width
			, state_name: state_name
			, height: this.options.height
		});
		this.substate_views[index] = new_substate_view;
		state_view.onStatesReady();
		*/
	};
	proto.onKeyChange = function(new_state_name, old_state_name, index) {
		var substate_view = this.substate_views[index];
		substate_view.option("state_name", new_state_name);
	};
	proto.option = function(key, value, animated) {
		if(arguments.length <= 1) {
			return this.options[key];
		} else {
			this.options[key] = value;
			if(key === "left") {
				this.antenna.option("left", this.option("left") + (this.option("width") / 2), animated);
				this.label.option("x", this.option("left") + (this.option("width") / 2), animated);
			}
			return this;
		}
	};
	proto.remove = function(animated) {
		if(_.has(this, "antenna")) {
			this.antenna.remove(animated);
		}
		if(_.has(this, "label")) {
			this.label.off("change", this.$onRenameRequested);
			this.label.remove(animated);
		}
	};
	proto.onRenameRequested = function(event) {
		var new_name = event.value;
		var parent_statechart = this.statechart.parent();
		if(parent_statechart) {
			parent_statechart.rename_substate(this.statechart.get_name(parent_statechart), new_name);
		}
	};
}(StatechartView));
red.define("statechart_view", function(a, b, c) { return new StatechartView(a,b,c); });
}(red));

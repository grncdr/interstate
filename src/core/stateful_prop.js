(function(red) {
var cjs = red.cjs, _ = cjs._;

var RedStatefulProp = function(options) {
	options = options || {};
	if(!options.parent) { options.parent = undefined; }

	var self = this;

	this._parent = cjs.create("constraint", options.parent, true);
	this._statechart = cjs.create("constraint", _.bind(this._root_statechart_getter, this));
	this._statechart_constraint = cjs.create("statechart_constraint", this._statechart);
	this._direct_values = cjs.create("map");
/*
	this._parent = cjs(parent);
	this._direct_values = cjs.create("map");
	this._name = cjs.create("constraint", name);

	this._context = cjs.create("red_context", {
		thisable: false
	});
	this._context.set("event", cjs(_.bind(this.get_event, this)));
*/

	this._states = cjs(_.bind(this._states_getter, this));
	this._values = this._states.map(
						function(state) {
							return cjs.create("constraint", function() {
								return cjs.get(self._value_for_state(state));	
							});
						}
					);
	_.forEach(this._values.get(), function(value, index) {
		self._on_value_added(value, index);
	});
	this._values.onAdd   (_.bind(this._on_value_added,   this))
				.onRemove(_.bind(this._on_value_removed, this))
				.onMove  (_.bind(this._on_value_moved,   this));
};
(function(my) {
	var proto = my.prototype;

	//
	// ===== PARENTAGE =====
	//

	proto.get_parent = function() { return this._parent.get(); };
	proto.set_parent = function(parent) { this._parent.set(parent); };
	proto.get_stateful_obj_parent = function() {
		var prop_obj = this.get_parent();
		if(prop_obj) {
			var stateful_obj = prop_obj.get_parent();
			if(stateful_obj) {
				return stateful_obj;
			}
		}
		return undefined;
	};
	proto._root_statechart_getter = function() {
		var stateful_obj = this.get_stateful_obj_parent();
		if(stateful_obj) {
			return stateful_obj.get_statechart();
		} else {
			return undefined;
		}
	};
	
	//
	// ===== STATECHART =====
	//
	
	proto._states_getter = function() {
		var stateful_obj = this.get_stateful_obj_parent();
		if(stateful_obj) {
			return stateful_obj.get_states();
		} else {
			return [];
		}
	};
	
	//
	// ===== VALUES =====
	//
	
	proto._direct_value_for_state = function(state) {
		return this._direct_values.get(state);
	};

	proto._value_for_state = function(state) {
		var direct_value = this._direct_value_for_state(state);
		//console.log(direct_value, state, state.id);
		
		if(direct_value) {
			return direct_value;
		} else {
			var proto_value = this._get_prototype_value_for_state(state);
			if(proto_value && proto_value.clone) {
				var cloned_value = proto_value.clone(this);
				//cloned_value.set_parent(this);
				return cloned_value;
			} else if(proto_value) {
				return proto_value;
			} else {
				return undefined;
			}
		}
	};
	
	proto.get_value = function(state) {
		return this._statechart_constraint.get_value_for_state(state);
	};

	proto.get = function() {
		return cjs.get(this._statechart_constraint, true);
	};
	proto.set_value = function(state, value) {
		this._direct_values.set(state, value);
		return this;
	};
	proto.unset_value = function(state) {
		this._direct_values.unset(state);
		return this;
	};

	proto._on_value_added = function(value, index) {
		var states = this._states.get();
		var state = states[index];
		if(state) {
			this._statechart_constraint.set_value_for_state(state, value);
		}
	};
	proto._on_value_removed = function(value, index) {
		var states = this._states.get();
		var state = states[index];
		if(state) {
			this._statechart_constraint.unset_value_for_state(state);
		}
	};
	proto._on_value_moved = function(value, from_index, to_index) {
		var states = this._states.get();
		var state = states[from_index];
		if(state) {
			this._statechart_constraint.move_value_for_state(state, value);
		}
	};
	
	// 
	// ===== PROTOTYPES =====
	//
	
	proto.get_prototypes = function() {
		var parent = this.get_parent();
		if(parent) {
			return parent.prop_prototypes(this);
		}
	};

	proto._get_prototype_value_for_state = function(state) {
		var basis = state.get_basis();
		var inherits_from = this._get_inherits_from();
		var len = inherits_from.length;
		for(var i = 0; i<len; i++) {
			var p_value = inherits_from[i]._direct_value_for_state(basis);
			if(!_.isUndefined(p_value)) {
				return p_value;
			}
		};
	};

	proto._get_inherits_from = function() {
		var parent = this.get_parent();
		if(parent) {
			var parent_inherits_from = parent.inherits_from();
			return _.map(parent_inherits_from, function(prop_obj) {
				return prop_obj.get_value();
			});
		}
		return [];
	};
	/*

	//
	// ===== INITIALIZERS/DESTROYERS =====
	//
	
	proto.destroy = function() {};

	proto.get_context = function() { return this._context; };
	proto.set_name = function(name) { this._name.set(name); return this; };
	proto.get_name = function(name) { return this._name.get(); };


	proto.get_root_statechart = function() {
		var parent = this.get_parent();
		if(!parent) {
			return undefined;
		} else {
			return parent.get_statechart();
		}
	};

	proto.get_statechart_event = function() {
		var root_statechart = this.get_root_statechart();
		return root_statechart._event;
	};


	//
	// ===== STATECHART =====
	//

	proto.my_version_of_state = function(state) {
		var parent = this.parent();
		if(parent) {
			return parent.get_state_shadow(state);
		} else {
			return undefined;
		}
	};

	proto.get_states = function() {
		var parent = this.get_parent();
		if(parent) {
			return parent.get_states();
		} else {
			return [];
		}
	};

	proto.state_is_inherited = function(state) {
		var parent = this.get_parent();
		if(parent) {
			return parent.state_is_inherited(state);
		} else {
			return false;
		}
	};

	*/
}(RedStatefulProp));

red.RedStatefulProp = RedStatefulProp;

cjs.define("red_stateful_prop", function(options) {
	var property = new RedStatefulProp(options);
	var constraint = cjs(function() {
		var val = property.get();
		return cjs.get(val); //Double constraint if inherited
	});
	constraint.set_value = _.bind(property.set_value, property);
	constraint.unset_value = _.bind(property.unset_value, property);
	constraint.get_value = _.bind(property.get_value, property);
	constraint.get_parent = _.bind(property.get_parent, property);
	constraint.set_parent = _.bind(property.set_parent, property);
	constraint.clone = function(options) {
		options = options || {};
		return cjs.create("red_stateful_prop", options);
	};
	constraint._direct_value_for_state= _.bind(property._direct_value_for_state, property);
	/*
	constraint.get_context = _.bind(property.get_context, property);
	constraint.set_name = _.bind(property.set_name, property);
	*/
	constraint.type = "red_stateful_prop";
	return constraint;
});

}(red));
/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,console */

(function (ist) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	ist.find_equivalent_state = function (to_state, in_tree) {
		var in_tree_basis = in_tree.basis();
		var in_tree_basis_lineage = in_tree_basis.get_lineage();
		var to_state_lineage = to_state.get_lineage();

		var in_tree_basis_lineage_len = in_tree_basis_lineage.length;
		var to_state_lineage_len = to_state_lineage.length;
		
		var in_tree_basis_index = in_tree_basis_lineage_len - 1;
		var to_state_index;
		var i;

		outer_loop:
		while (in_tree_basis_index >= 0) {
			for (i = to_state_lineage_len - 1; i >= 0; i -= 1) {
				if (to_state_lineage[i] === in_tree_basis_lineage[in_tree_basis_index]) {
					to_state_index = i;
					break outer_loop;
				}
			}
			in_tree_basis_index -= 1;
		}
		var search_item = in_tree;
		var parentage_level = in_tree_basis_lineage_len - 1 - in_tree_basis_index;
		_.times(parentage_level, function () {
			search_item = search_item.parent();
		});

		for (i = to_state_index + 1; i < to_state_lineage_len; i += 1) {
			var name = to_state_lineage[i - 1].get_name_for_substate(to_state_lineage[i]);
			search_item = search_item.get_substate_with_name(name);
		}

		//if (search_item.basis() !== to_state) { throw new Error("Could not find correct equivalent item"); }

		return search_item;
	};

	ist.State = function (options) {
		this._constructed = false;
		options = options || {};

		if(!this._started_construction) {
			this._started_construction = true;

			able.make_this_listenable(this);

			this._initialized = false;
			this.$initialized = cjs(false);

			this._id = options.id || uid();
			this._hash = uid.strip_prefix(this._id);

			this._running = options.running === true;
			this.$running = cjs(this._running);

			ist.register_uid(this._id, this);
		}

		//if(this.sid() === 907) debugger;
		if(options.avoid_constructor) { return; }

		this._last_run_event = cjs(false);

		this._puppet = options.puppet === true;
		this._parent = options.parent;
		if(options.context) {
			this.do_set_context(options.context);
		}

		this.$active = cjs(options.active === true || (!this._parent && !this._puppet));

		//this.set_basis(options.basis, options.set_basis_as_root);
		//if (this._basis) {
			//this.remove_basis_listeners();
		//}
		this._basis = options.basis;
		if (this._basis) {
			this.add_basis_listeners();
		}

		//if(this.sid() === 2141) debugger;
	};

	(function (my) {
		var proto = my.prototype;
		able.make_proto_listenable(proto);

		if(ist.__debug_statecharts) {
			proto.get_$running = function() {
				return this.$running.get();
			};
		}

		proto.is_constructed = function () {
			return this._constructed;
		};

		proto.initialize = function () {
			if (this._basis) { // shadow
				_.each(this.get_outgoing_transitions(), function(transition) {
					transition.initialize();
				});
			}
			this._initialized = true;
			this.$initialized.set(true);
			this._emit("initialized");
		};

		proto.is_initialized = function () {
			return this.$initialized.get();
		};

		proto.is_puppet = function () {
			return this._puppet;
		};

		proto.is_running = function () { return this._running; };

		proto.run = function () {
			if(this.is_puppet()) {
				this._running = true;
				this._emit("run", {
					target: this,
					type: "run"
				});
				//if(ist.__debug_statecharts) {
					this.$running.set(true);
				//}
			} else if (!this.is_running()) {
				ist.event_queue.wait();
				this.enable_outgoing_transitions();

				this._running = true;
				this._emit("run", {
					target: this,
					type: "run"
				});
				//if(ist.__debug_statecharts) {
					this.$running.set(true);
				//}
				ist.event_queue.signal();
			}
		};
		proto.stop = function () {
			if(this.is_puppet()) {
				this._running = false;
				this._emit("stop", {
					type: "stop",
					target: this
				});
				//if(ist.__debug_statecharts) {
					this.$running.set(false);
				//}
			} else {
				ist.event_queue.wait();
				this._running = false;
				this.disable_outgoing_transitions();
				this._emit("stop", {
					type: "stop",
					target: this
				});
				//if(ist.__debug_statecharts) {
					this.$running.set(false);
				//}
				ist.event_queue.signal();
			}
		};
		proto.reset = function () {
			if (this.is_running()) {
				ist.event_queue.wait();
				this.stop();
				this.run();
				ist.event_queue.signal();
			}
			return this;
		};

/*
		proto.set_basis = function (basis, as_root) {
			if (this._basis) {
				this.remove_basis_listeners();
			}
			this._basis = basis;
			if (this._basis) {
				if (this._basis instanceof ist.Statechart) {
					var basis_start_state = this._basis.get_start_state();
					var basis_start_state_to = basis_start_state.getTo();
					var is_running = this.is_running();
					var my_context = this.context();
					var is_concurrent = this.is_concurrent();

					_.each(basis.get_substates(true), function (substate, name) {
						var shadow = substate.create_shadow({
							context: my_context,
							parent: this,
							running: is_running && (basis_start_state_to === substate || is_concurrent),
							active: is_running && (basis_start_state_to === substate || is_concurrent),
							set_basis_as_root: false
						});
						if (shadow instanceof ist.StartState) {
							this.set_start_state(shadow);
						} else {
							this.add_substate(name, shadow);
						}
					}, this);
					_.each(this._basis._transition_listeners, function (listeners, name) {
						_.each(listeners, function (info) {
							this.on_transition(info.str, info.activation_listener, info.deactivation_listener, info.context);
						}, this);
					}, this);
				}
				if (as_root === true) { // When all of the substates have been copied
					var parent_statechart = this,
						context = this.context();

					var create_transition_shadow = _.memoize(function (transition) {
						var from = ist.find_equivalent_state(transition.from(), parent_statechart);
						var to = ist.find_equivalent_state(transition.to(), parent_statechart);
						return transition.create_shadow(from, to, parent_statechart, context);
					}, function (transition, from) {
						return transition.id();
					});

					this.do_shadow_transitions(create_transition_shadow);
				}

				this.add_basis_listeners();
			}
			return this;
		};
		*/

		proto.do_shadow_transitions = function(create_transition_shadow) {
			var basis = this.basis();
			var outgoing_transitions = basis.get_outgoing_transitions();
			var shadow_outgoing = _.map(outgoing_transitions, create_transition_shadow);

			_.each(shadow_outgoing, function (transition) {
				var from = transition.from();
				var to = transition.to();
				from._add_direct_outgoing_transition(transition);
				to._add_direct_incoming_transition(transition);
			}, this);

			var substates = this.get_substates(true);
			_.each(substates, function(substate) {
				substate.do_shadow_transitions(create_transition_shadow);
			}, this);
		};

		proto.set_active = function (to_active) {
			if(this.$active) {
				this.$active.set(to_active === true);
				if(!to_active) {
					_.each(this.get_substates(true), function(substate) {
						substate.set_active(false);
						substate.disable_outgoing_transitions();
						substate.stop();
					}, this);
				}
				var event_type = to_active ? "active" : "inactive";
				this._emit(event_type, {
					type: event_type,
					target: this
				});
			}
		};
		proto.flatten_substates = function (include_start) {
			return _.flatten(_.map(this.get_substates(include_start), function (substate) {
				return substate.flatten_substates(include_start);
			})).concat([this]);
		};

		proto.get_all_transitions = function() {
			var flat_substates = this.flatten_substates(false),
				transitions = _	.chain(flat_substates)
								.map(function(substate) {
									return substate.get_incoming_transitions();
								})
								.flatten(true)
								.value();
			return transitions;
		};
		proto.is_active = function (to_active) { return this.$active && this.$active.get(); };
		proto.get_name = function (relative_to) {
			var parent = this.parent();
			if (!relative_to) {
				relative_to = this.root();
			} else if (relative_to === 'parent') {
				relative_to = parent;
			}

			var my_name = parent ? parent.get_name_for_substate(this) : "";
			if (parent === relative_to) {
				return my_name;
			} else {
				var parent_name = parent ? parent.get_name(relative_to) : "";
				if (parent_name === "") {
					return my_name;
				} else {
					return parent_name + "." + my_name;
				}
			}
		};
		proto.id = function () { return this._id; };
		proto.hash = function () { return this._hash; };
		proto.sid = function() { return parseInt(uid.strip_prefix(this.id()), 10); };
		proto.basis = function () { return this._basis; };
		proto.parent = function () { return this._parent; };
		proto.context = function () { return this._context; };
		proto.original_context = function() { return this._original_context; };
		proto.set_parent = function (parent) { this._parent = parent; return this; };
		proto.set_context = function (context) {
			this.do_set_context(context);
			_.each(this.get_substates(true), function(substate) {
				substate.set_context(context);
			});
			var outgoing_transitions = this.get_outgoing_transitions();
			_.each(this.get_outgoing_transitions(),
				function (x) {
					x.enable();
				});
			return this;
		};
		proto.do_set_context = function(context) {
			this._context = context.push_special_context(new ist.StateContext(this));
			this._original_context = context;
		};

		proto.is_based_on = function (state) {
			return this.basis() === state;
		};

		proto.is_child_of = function (node) {
			var curr_parent = this.parent();
			while (curr_parent) {
				if (curr_parent === node) {
					return true;
				}
				curr_parent = curr_parent.parent();
			}
			return false;
		};

		proto.get_lineage = function (until_state) {
			var curr_node = this;
			var parentage = [];
			var i = 0;
			do {
				parentage[i] = curr_node;
				i += 1;
				if (curr_node === until_state) { break; }
				curr_node = curr_node.parent();
			} while (curr_node);
			return parentage.reverse();
		};

		proto.root = function () {
			var parent = this.parent();
			if (parent) {
				return parent.root();
			} else {
				return this;
			}
		};

		proto.on_outgoing_transition_fire = function (transition, event) {
			var i;

			if (this.is_running() && _.indexOf(this.get_outgoing_transitions(), transition) >= 0) {
				transition._last_run_event.set(event);
				
				var my_lineage = this.get_lineage();
				/*
				for (i = 0; i < my_lineage.length - 1; i += 1) {
					if (!my_lineage[i].is(my_lineage[i + 1])) {
						return false;
					}
				}
				*/

				var to = transition.to();
				var to_lineage = to.get_lineage();
				var to_len = to_lineage.length;

				var min_len = Math.min(to_len, my_lineage.length);

				//console.log("from ", _.map(my_lineage, function(x) { return x.get_name(); }));
				//console.log("to   ", _.map(to_lineage, function(x) { return x.get_name(); }));

				for (i = 0; i < min_len; i += 1) {
					if (to_lineage[i] !== my_lineage[i]) {
						i--; //back up...
						break;
					}
				}
				if (i === to_len) { //if it is a self-transition. Just handle it on the lowest level possible
					i -= 2;
				}

				//cjs.wait();
				var active_substate, parent, min_common_i = i;
				while (i < to_len - 1) {
					parent = to_lineage[i];
					active_substate = to_lineage[i + 1];
					parent.set_active_substate(active_substate, transition, event);
					i++;
				}

				if(active_substate instanceof ist.Statechart) {
					var start_state = active_substate.get_start_state();
					active_substate.set_active_substate(start_state, transition, event);
				}


				ist.event_queue.once("end_event_queue_round_0", function () {
					this._emit("pre_transition_fire", {
						type: "pre_transition_fire",
						transition: transition,
						//target: this,
						event: event,
						state: to
					});
					transition.set_active(true);
				}, this);

				ist.event_queue.once("end_event_queue_round_2", function () {
					transition.increment_times_run();
				}, this);

				ist.event_queue.once("end_event_queue_round_4", function () {
					transition.set_active(false);
					this._emit("post_transition_fire", {
						type: "post_transition_fire",
						transition: transition,
						//target: this,
						event: event,
						state: to
					});
				}, this);

				//cjs.signal();
				return true;
			}
			return false;
		};

		proto.order = function (other_state) {
			var i;
			// return 1 if other_state is ">" me (as in should be further right)
			// return -1 if other_state is "<" me (as in should be further left)
			// return 0 if other_state is "==" me (same thing)

			var my_lineage = this.get_lineage(),
				other_lineage = other_state.get_lineage(),
				mli = my_lineage[0],
				oli = other_lineage[0];

			if(mli !== oli) { // different root
				return 0;
			}

			var len = Math.min(my_lineage.length, other_lineage.length),
				index_me, index_o;

			for (i = 1; i < len; i += 1) {
				index_me = mli.get_substate_index(my_lineage[i]);
				index_o = oli.get_substate_index(other_lineage[i]);
				if (index_me < index_o) {
					return 1;
				} else if (index_me > index_o) {
					return -1;
				}
				mli = my_lineage[i];
				oli = other_lineage[i];
			}

			if (other_lineage.length > my_lineage.length) { // It is more specific
				return -1;
			} else if (other_lineage.length < my_lineage.length) {
				return 1;
			} else { // We are exactly the same
				return 0;
			}
		};
		proto.enable_outgoing_transitions = function () {
			var outgoing_transitions = this.get_outgoing_transitions();
			_.each(outgoing_transitions, function (x) { x.enable(); });
		};
		proto.disable_outgoing_transitions = function () {
			this.disable_immediate_outgoing_transitions();
			var substates = this.get_substates();
			_.each(substates, function (x) { x.disable_outgoing_transitions(); });
		};
		proto.disable_immediate_outgoing_transitions = function() {
			var transitions = this.get_outgoing_transitions();
			_.each(transitions, function (x) { x.disable(); });
		};
		proto.disable_immediate_incoming_transitions = function() {
			var transitions = this.get_incoming_transitions();
			_.each(transitions, function (x) { x.disable(); });
		};
		proto.parent_is_concurrent = function() {
			var parent = this.parent();
			if(parent) {
				return parent.is_concurrent();
			} else {
				return false;
			}
		};

		proto.summarize = function () {
			var context = this.context();
			var summarized_context;
			if (context) {
				summarized_context = context.summarize();
			}
			var my_basis = this.basis() || this;
			return {
				basis_id: my_basis.id(),
				context: summarized_context
			};
		};
		my.desummarize = function (obj) {
			if (obj.context) {
				var state_basis = ist.find_uid(obj.basis_id);
				var context = ist.Pointer.desummarize(obj.context);
				var dict = context.points_at();
				var contextual_statechart = dict.get_statechart_for_context(context);

				var state = ist.find_equivalent_state(state_basis, contextual_statechart);
				return state;
			} else {
				return ist.find_uid(obj.basis_id);
			}
		};
		proto.add_basis_listeners = function() {
			this._basis.on("add_transition", this.onBasisAddTransition, this);
			this._basis.on("add_substate", this.onBasisAddSubstate, this);
			this._basis.on("remove_substate", this.onBasisRemoveSubstate, this);
			this._basis.on("rename_substate", this.onBasisRenameSubstate, this);
			this._basis.on("move_substate", this.onBasisMoveSubstate, this);
			this._basis.on("make_concurrent", this.onBasisMakeConcurrent, this);
			this._basis.on("on_transition", this.onBasisOnTransition, this);
			this._basis.on("off_transition", this.onBasisOffTransition, this);
			this._basis.on("destroy", this.onBasisDestroy, this);
		};
		proto.remove_basis_listeners = function() {
			this._basis.off("add_transition", this.onBasisAddTransition, this);
			this._basis.off("add_substate", this.onBasisAddSubstate, this);
			this._basis.off("remove_substate", this.onBasisRemoveSubstate, this);
			this._basis.off("rename_substate", this.onBasisRenameSubstate, this);
			this._basis.off("move_substate", this.onBasisMoveSubstate, this);
			this._basis.off("make_concurrent", this.onBasisMakeConcurrent, this);
			this._basis.off("on_transition", this.onBasisOnTransition, this);
			this._basis.off("off_transition", this.onBasisOffTransition, this);
			this._basis.off("destroy", this.onBasisDestroy, this);
		};
		proto.onBasisAddTransition = function (event) {
			var transition = event.transition;
			var new_from = ist.find_equivalent_state(event.from_state, this);
			var new_to = ist.find_equivalent_state(event.to_state, this);
			var transition_shadow = transition.create_shadow(new_from, new_to, this, this.context());
			new_from._add_direct_outgoing_transition(transition_shadow);
			new_to._add_direct_incoming_transition(transition_shadow);
			this.add_transition(transition_shadow);
		};
		proto.onBasisAddSubstate = function (event) {
			var state_name = event.state_name,
				state = event.state,
				index = event.index;
			this.add_substate(state_name, state.create_shadow({parent: this, context: this.context()}), index);
		};
		proto.onBasisRemoveSubstate = function (event) {
			this.remove_substate(event.name, undefined, false);
		};
		proto.onBasisRenameSubstate = function (event) {
			var from_name = event.from,
				to_name = event.to;
			this.rename_substate(from_name, to_name);
		};
		proto.onBasisMoveSubstate = function (event) {
			var state_name = event.state_name,
				index = event.index;
			this.move_state(state_name, index);
		};
		proto.onBasisMakeConcurrent = function (event) {
			this.make_concurrent(event.concurrent);
		};
		proto.onBasisOnTransition = function (event) {
			this.on_transition(event.str, event.activation_listener, event.deactivation_listener, event.context);
		};
		proto.onBasisOffTransition = function (event) {
			this.off_transition(event.str, event.activation_listener, event.deactivation_listener, event.context);
		};
		proto.onBasisDestroy = function (event) {
			this.destroy(true);
		};

		proto.destroy = function (silent) {
			this.destroyed = true;
			if(this.$active) {
				this.$active.destroy(silent);
				delete this.$active;
			}
			if(this.$running) {
				this.$running.destroy(silent);
				delete this.$running;
			}
			this.$initialized.destroy(silent);
			this._last_run_event.destroy(silent);
			delete this._last_run_event;
			if (this._basis) {
				this.remove_basis_listeners();
				delete this._basis;
			}
			delete this._parent;
			delete this._context;
			able.destroy_this_listenable(this);
			ist.unregister_uid(this.id());
		};

		proto.pause = function() {
			if(this.is_active()) {
				this.disable_immediate_outgoing_transitions();

				_.each(this.get_substates(true), function(substate) {
					substate.pause();
				});
			}
		};
		proto.resume = function() {
			if(this.is_active()) {
				this.enable_outgoing_transitions();

				_.each(this.get_substates(true), function(substate) {
					substate.resume();
				});
			}
		};
	}(ist.State));
}(interstate));

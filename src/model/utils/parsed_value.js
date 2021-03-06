/*jslint evil:true,nomen: true, vars: true, bitwise:true */
/*global interstate,esprima,able,uid,console,window */

(function (ist) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._,
		esprima = window.esprima,
		destroy_if_constraint = function(x, silent) {
			if(cjs.isConstraint(x)) {
				x.destroy(silent);
			}
		},
		set_destroy = function(x, func) {
			if(cjs.isConstraint(x)) {
				var old_destroy = x.destroy;
				x.destroy = function() {
					func.apply(x, arguments);
					old_destroy.apply(x, arguments);
				};
			}
		};

	var assignmentExpression = {};

	ist.construct = function(constructor, args) {
		if(constructor === Date) { // Functions check to see if date object
			var rv = eval("new constructor(" + args.join(",") + ")");
			return rv;
		}
		function F() {
			return constructor.apply(this, args);
		}
		F.prototype = constructor.prototype;
		return new F();
	};

	ist.MultiExpression = function(expressions) {
		this.expressions = expressions;
	};

	(function(My) {
		var proto = My.prototype;
		proto.get_expressions = function() {
			return this.expressions;
		};
		proto.first = function() {
			return _.first(this.expressions);
		};
		proto.rest = function() {
			return _.rest(this.expressions);
		};
		proto.last = function() {
			return _.last(this.expressions);
		};
	}(ist.MultiExpression));

	ist.on_event = function (event_type, arg1, arg2, arg3, arg4) {
		if (event_type === "timeout") {
			//console.log(arg1);
			var timeout_event = new ist.TimeoutEvent(arg1);
			return timeout_event;
		} else if(event_type === "time") {
			var time_event = new ist.TimeEvent(arg1);
			return time_event;
		} else if(event_type === "frame") {
			var frame_event = new ist.FrameEvent();
			return frame_event;
		} else if(event_type === "cross") {
			var touchCluster = arg1,
				target = arg2,
				min_velocity = arg3,
				max_velocity = arg4,
				cross_event = new ist.CrossEvent(touchCluster, target, min_velocity, max_velocity);

			return cross_event;
		} else if(event_type === "collision") {
			var	targs_a = arg1,
				targs_b = arg2,
				collision_event = new ist.CollisionEvent(targs_a, targs_b);

			return collision_event;
		} else {
			var targets = _.rest(arguments);
			var events = [];

			if (targets) {
				var statechart_spec = event_type;
				var statechart_event = new ist.TransitionEvent(targets, statechart_spec);
				events.push(statechart_event);

				if (arguments.length <= 1) { // Ex: on('mouseup') <-> on('mouseup', window)
					targets = window;
				}
				var ist_event_type = event_type;
				var ist_event = new ist.IstObjEvent(ist_event_type, targets);
				events.push(ist_event);
			}
			if (arguments.length <= 1) { // Ex: on('mouseup') <-> on('mouseup', window)
				targets = window;
			}
			var dom_event = new ist.DOMEvent(event_type, targets);
			events.push(dom_event);

			return new ist.CombinationEvent(events);
		}
	};

	ist.register_serializable_type("ist_on_event_func",
		function (x) {
			return x === ist.on_event;
		},
		function () {
			return {};
		},
		function (obj) {
			return ist.on_event;
		});

	ist.binary_operators = {
		"===":	function (a, b) { return ist.check_contextual_object_equality_eqeqeq(a, b); },
		"!==":	function (a, b) { return !ist.check_contextual_object_equality_eqeqeq(a, b); },
		"==":	function (a, b) { return ist.check_contextual_object_equality_eqeqeq(a, b); },
		"!=":	function (a, b) { return !ist.check_contextual_object_equality_eqeqeq(a, b); },
		">":	function (a, b) { return a > b; },
		">=":	function (a, b) { return a >= b; },
		"<":	function (a, b) { return a < b; },
		"<=":	function (a, b) { return a <= b; },
		"+":	function (a, b) { return a + b; },
		"-":	function (a, b) { return a - b; },
		"*":	function (a, b) { return a * b; },
		"/":	function (a, b) { return a / b; },
		"%":	function (a, b) { return a % b; },
		"&&":	function (a, b) { return a && b; },
		"||":	function (a, b) { return a || b; },
		"&":	function (a, b) { return a & b; },
		"|":	function (a, b) { return a | b; },
		"^":	function (a, b) { return a ^ b; },
		"<<":	function (a, b) { return a << b; },
		">>":	function (a, b) { return a >> b; },
		">>>":  function (a, b) { return a >>> b; },
		"in":	function (a, b) { return a in b; },
		"instanceof":	function (a, b) { return a instanceof b; }
	};
	ist.unary_operators = {
		"-":	function (a) { return -a; },
		"!":	function (a) { return !a; },
		"~":	function (a) { return ~a; },
		"typeof":	function (a) { return typeof a; }
	};

	var destroy_constraint_fn = cjs.Constraint.prototype.destroy;

	var get_op_val = function (options, calling_context, op) {
		var pcontext = options.context,
			args = _.rest(arguments, 3);
		if (options.get_constraint) {
			var constraint = cjs(function () {
				var op_got = cjs.get(op, options.auto_add_dependency),
					args_got, rv;
				if(_.isFunction(op_got) || op_got instanceof ist.ParsedFunction) {
					var calling_context_got = cjs.get(calling_context, options.auto_add_dependency);

					args_got = _.map(args, function(arg) {
													return cjs.get(arg, options.auto_add_dependency);
												});

					if(op_got === ist.find_fn) {
						// Give it the context of root
						rv = op_got.apply(pcontext, args_got);
						return rv;
					} else if (_.isFunction(op_got)) {
						rv = op_got.apply(calling_context_got, args_got);
						return rv;
					} else if (op_got instanceof ist.ParsedFunction) {
						return op_got._apply(calling_context_got, pcontext, args_got, options);
					}
				} else if( op_got instanceof ist.ContextualDict) {
					var proto = op_got,
						arg_arr = [];
					args_got = {
					};
					_.each(args, function(arg, index) {
						var value;
						if(arg.type === assignmentExpression) {
							value = arg.value;

							var name = arg.identifier;
							args_got[name] = value;
						} else {
							value = arg;
						}
						arg_arr[index] = value;
					});

					args_got["arguments"] = cjs(arg_arr);
					var constructor_fn = op_got instanceof ist.ContextualStatefulObj ? ist.StatefulObj : ist.Dict;

					rv = new constructor_fn({
						value: args_got,
						direct_protos: op
					});
					return rv;
				} else {
					throw new Error("Calling a non-function");
					//return undefined;
				}
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			if (_.isFunction(op)) {
				return op.apply(calling_context, args);
			} else if (op instanceof ist.ParsedFunction) {
				return op._apply(calling_context, pcontext, args);
			} else {
				throw new Error("Calling a non-function");
				//return undefined;
			}
		}
	};

	var AND_OP = 0, OR_OP = 1;
	var get_logical_val = function (op, left, right, options) {
		if (options.get_constraint) {
			var op_id;
			if (op === "&&") {
				op_id = AND_OP;
			} else if (op === "||") {
				op_id = OR_OP;
			} else {
				console.error("Unknown op " + op);
			}
			var constraint = cjs(function () {
				switch (op_id) {
				case AND_OP:
					return cjs.get(left, options.auto_add_dependency) && cjs.get(right, options.auto_add_dependency);
				case OR_OP:
					return cjs.get(left, options.auto_add_dependency) || cjs.get(right, options.auto_add_dependency);
				}
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			if (op === "&&") {
				return left && right;
			} else if (op === "||") {
				return left || right;
			} else {
				console.error("Unknown op " + op);
			}
		}
	};

	var get_conditional_val = function (test, consequent, alternate, options) { // test ? consequent : alternate
		if (options.get_constraint) {
			var constraint = cjs(function () {
				var test_got = cjs.get(test, options.auto_add_dependency);
				if (test_got) {
					return cjs.get(consequent, options.auto_add_dependency);
				} else {
					return cjs.get(alternate, options.auto_add_dependency);
				}
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			if (test) {
				return consequent;
			} else {
				return alternate;
			}
		}
	};

	var IDENTIFIER = {
		COBJ_ROOT: ist.root_name,
		JS_ROOT: "window",
		CONTAINER: "container",
		PROTO_THIS: "$this",
		ROOT_THIS: "$$this"
	};

	var get_identifier_val = function (key, options) {
		var context = options.context,
			ignore_inherited_in_contexts = options.ignore_inherited_in_contexts || [],
			cobj;

		if (key === IDENTIFIER.COBJ_ROOT) {
			return ist.find_or_put_contextual_obj(context.root(), context.slice(0, 1));
		} else if (key === IDENTIFIER.JS_ROOT) {
			return window;
		} else if(key === IDENTIFIER.PROTO_THIS || key === IDENTIFIER.ROOT_THIS) {
			cobj = options.inherited_from_cobj;

			if(cobj) {
				if (key === IDENTIFIER.PROTO_THIS) {
					context = cobj.get_pointer();
				} else if (key === IDENTIFIER.ROOT_THIS) {
					do {
						context = cobj;
						cobj = cobj.is_inherited();
					} while(cobj);
					
					context = context.get_pointer();
				}
				return get_this_val(_.extend({}, options, {
					context: context
				}));
			} else {
				return get_this_val(options);
			}
		}

		var getter = function () {
			var i, curr_context, context_item, rv;
			if (key === IDENTIFIER.CONTAINER) {
				var found_this = false;
				curr_context = context;
				context_item = curr_context.points_at();

				while (!curr_context.is_empty()) {
					if (context_item instanceof ist.Dict) {
						if (found_this) {
							rv = curr_context.getContextualObject();
							return rv;
						} else {
							found_this = true;
						}
					}
					curr_context = curr_context.pop();
					context_item = curr_context.points_at();
				}
			}

			curr_context = context;
			context_item = curr_context.points_at();
				
			while (!curr_context.is_empty()) {
				if (context_item instanceof ist.Dict) {
					var contextual_obj = curr_context.getContextualObject();
					if (contextual_obj.has(key, _.indexOf(ignore_inherited_in_contexts, context_item)>=0)) {
						rv = contextual_obj._prop_val(key);
						return rv;
					}
				} else if (context_item instanceof ist.ProvisionalContext) {
					if(context_item.has(key)) {
						return context_item.get(key);
					}
				}

				if(curr_context.has_special_contexts()) {
					var special_contexts = curr_context.special_contexts();
					var len = special_contexts.length;
					for (i = 0; i < len; i += 1) {
						var sc = special_contexts[i];
						var context_obj = sc.get_context_obj();
						if (context_obj.hasOwnProperty(key)) {
							var value = context_obj[key].value;
							if(cjs.isConstraint(value)) {
								return value.get();
							} else {
								return value;
							}
						}
					}
				}
					
				curr_context = curr_context.pop();
				context_item = curr_context.points_at();
			}
			if (window.hasOwnProperty(key)) {
				return window[key];
			} else {
				throw new Error("Could not find variable '" + key + "'");
				//return undefined;
			}
		};

		if (options.get_constraint) {
			var constraint = cjs(getter);
			constraint.destroy = function() {
				context = false;
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			return getter();
		}
	};

	var get_this_val = function (options) {
		var context = options.context;
		var getter = function () {
			var curr_context = context;
			var context_item = curr_context.points_at();

			while (!curr_context.is_empty()) {
				if (context_item instanceof ist.Dict) {
					var contextual_obj = ist.find_or_put_contextual_obj(context_item, curr_context);
					return contextual_obj;
				}
				curr_context = curr_context.pop();
				context_item = curr_context.points_at();
			}

			throw new Error("Could not find this");
			//return undefined;
		};
		if (options.get_constraint) {
			var constraint = cjs(getter);
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			return getter();
		}
	};

	var get_member_val = function (obj, prop, options) {
		var getter = function (object, property) {
			var rv, instances;
			if (!object) {
				//throw new Error("No parent object for property '" + prop + "'");
				return undefined;
			}
			if (object instanceof ist.ContextualObject) {
				if (property === "container") {
					var found_this = false;
					var curr_context = object.get_pointer();
					var context_item = curr_context.points_at();

					while (!curr_context.is_empty()) {
						if (context_item instanceof ist.Dict) {
							if (found_this) {
								rv = ist.find_or_put_contextual_obj(context_item, curr_context);
								return rv;
							} else {
								found_this = true;
							}
						}
						curr_context = curr_context.pop();
						context_item = curr_context.points_at();
					}
				} else if (object.is_template && object.is_template()) {
					if( _.isNumber(property)) {
						instances = object.instances();
						if(instances.hasOwnProperty(property)) {
							return instances[property];
						} else {
							throw new Error("No such property '" + property + "'");
						}
					} else if(property === "length") {
						instances = object.instances();
						return instances.length;
					}
				}
				rv = object.prop_val(property);

				if(rv === undefined && !object.has(property)) {
					throw new Error("No such property '" + property + "'");
				}
				return rv;
			} else if(cjs.isArrayConstraint(object)) {
				if(_.isNumber(property)) {
					var item = object.item(property);
					if(cjs.isConstraint(item)) {
						return item.get();
					} else {
						return item;
					}
				} else {
					if(property === "length") {
						return object.length();
					}
				}
			} else if(cjs.isMapConstraint(object)) {
				return object.get(property);
			} else {
				return object[property];
			}
		};

		if (options.get_constraint) {
			var constraint = cjs(function () {
				var object;
				if(cjs.isConstraint(obj)) {
					object = obj.get(options.auto_add_dependency);
				} else {
					object = obj;
				}
				var property = cjs.get(prop, options.auto_add_dependency);
				return getter(object, property);
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			return getter(obj, prop);
		}
	};

	var get_array_val = function (elements, options) {
		if (options.get_constraint) {
			var constraint = cjs(function () {
				return _.map(elements, function (element) {
					return cjs.get(element, options.auto_add_dependency);
				});
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			return elements;
		}
	};

	var get_new_$ = function (options, calling_context, op) {
		var pcontext = options.context;
		var args = _.rest(arguments, 3);
		if (options.get_constraint) {
			var constraint = cjs(function () {
				var op_got = cjs.get(op, options.auto_add_dependency);
				var args_got = _.map(args, function(arg) {
													return cjs.get(arg, options.auto_add_dependency);
												});
				//window.dbg = false;
				var calling_context_got = cjs.get(calling_context, options.auto_add_dependency);

				if (_.isFunction(op_got)) {
					var rv = ist.construct.call(calling_context_got, op_got, args_got);
					return rv;
				} else if (op_got instanceof ist.ParsedFunction) {
					return op_got._apply(calling_context_got, pcontext, args_got, options);
				} else {
					throw new Error("Calling a non-function");
					//return undefined;
				}
			});
			constraint.destroy = function() {
				destroy_constraint_fn.apply(this, arguments);
			};
			return constraint;
		} else {
			if (_.isFunction(op)) {
				var rv = ist.construct.call(calling_context, op, args);
				return rv;
			} else if (op instanceof ist.ParsedFunction) {
				return op._apply(calling_context, pcontext, args);
			} else {
				throw new Error("Calling a non-function");
				//return undefined;
			}
		}
	};

	var get_val = ist.get_parsed_val = function (node, options) {
		var op_func, left_arg, right_arg, arg, callee, op_context, args, rv, object, property;
		if (!node) {
			return undefined;
		}
		var type = node.type;
		if (type === "ExpressionStatement") {
			rv = get_val(node.expression, options);
		} else if (type === "Literal") {
			rv = node.value;
		} else if (type === "BinaryExpression") {
			op_func = ist.binary_operators[node.operator];
			left_arg = get_val(node.left, options);
			right_arg = get_val(node.right, options);
			rv = get_op_val(options, window, op_func, left_arg, right_arg);
			set_destroy(rv, function(silent) {
				destroy_if_constraint(left_arg, silent);
				destroy_if_constraint(right_arg, silent);
			});
		} else if (type === "UnaryExpression") {
			op_func = ist.unary_operators[node.operator];
			arg = get_val(node.argument, options);
			rv = get_op_val(options, window, op_func, arg);
			set_destroy(rv, function(silent) {
				destroy_if_constraint(arg, silent);
			});
		} else if (type === "CallExpression") {
			var node_callee = node.callee;
			if (node_callee.type === "MemberExpression") {
				object = op_context = get_val(node_callee.object, options);
				property = node_callee.computed ? get_val(node_callee.property, options) : node_callee.property.name;

				callee = get_member_val(object, property, options);
				set_destroy(callee, function(silent) {
					destroy_if_constraint(object, silent);
					destroy_if_constraint(property, silent);
				});
			} else {
				callee = get_val(node_callee, options);
				op_context = window;
			}

			args = _.map(node["arguments"], function (arg) {
				return get_val(arg, options);
			});
			rv = get_op_val.apply(this, ([options, op_context, callee]).concat(args));

			set_destroy(rv, function(silent) {
				destroy_if_constraint(callee, silent);
				_.each(args, function(arg) {
					destroy_if_constraint(arg, silent);
				});
			});
		} else if (type === "Identifier") {
			rv = get_identifier_val(node.name, options);
		} else if (type === "ThisExpression") {
			rv = get_this_val(options);
		} else if (type === "MemberExpression") {
			object = get_val(node.object, options);
			property = node.computed ? get_val(node.property, options) : node.property.name;

			rv = get_member_val(object, property, options);
			set_destroy(rv, function(silent) {
				destroy_if_constraint(object, silent);
				destroy_if_constraint(property, silent);
			});
		} else if (type === "ArrayExpression") {
			var elements = _.map(node.elements, function (element) {
				return get_val(element, options);
			});
			rv = get_array_val(elements, options);
			set_destroy(rv, function(silent) {
				_.each(elements, function(elem) {
					destroy_if_constraint(elem, silent);
				});
			});
		} else if (type === "ConditionalExpression") {
			var test = get_val(node.test, options),
				consequent = get_val(node.consequent, options),
				alternate = get_val(node.alternate, options);
			rv = get_conditional_val(test, consequent, alternate, options);

			set_destroy(rv, function(silent) {
				destroy_if_constraint(test, silent);
				destroy_if_constraint(consequent, silent);
				destroy_if_constraint(alternate, silent);
			});
		} else if (type === "LogicalExpression") {
			left_arg = get_val(node.left, options);
			right_arg = get_val(node.right, options);
			rv = get_logical_val(node.operator, left_arg, right_arg, options);
			set_destroy(rv, function(silent) {
				destroy_if_constraint(left_arg, silent);
				destroy_if_constraint(right_arg, silent);
			});
		} else if (type === "FunctionExpression") {
			rv = ist.get_fn_$(node, options);
		} else if (type === "NewExpression") {
			callee = get_val(node.callee, options);
			op_context = window;
			if (node.callee.type === "MemberExpression") {
				op_context = get_val(node.callee.object, options);
			}
			args = _.map(node["arguments"], function (arg) {
				return get_val(arg, options);
			});
			rv = get_new_$.apply(this, ([options, op_context, callee]).concat(args));

			set_destroy(rv, function(silent) {
				destroy_if_constraint(callee, silent);
				destroy_if_constraint(op_context, silent);

				_.each(args, function(arg) {
					destroy_if_constraint(arg, silent);
				});
			});
		} else if (type === "ObjectExpression") {
			rv = {};
			_.each(node.properties, function (prop_node) {
				var key = prop_node.key.name,
					value = get_val(prop_node.value, options);
				rv[key] = value;
			});
		} else if (type === "Program") {
			if(node.body.length === 0) {
				rv = null;
			} else if(node.body.length === 1) {
				rv = get_val(node.body[0], options);
			} else {
				rv = new ist.MultiExpression(_.map(node.body, function(bodyi, i) {
					if(!options.only_parse_first || i === 0) {
						return get_val(bodyi, options);
					} else {
						return bodyi;
					}
				}));
			}
		} else if (type === "AssignmentExpression") {
			var identifier = node.left.name,
				value = get_val(node.right, options);

			rv = {
				type: assignmentExpression,
				identifier: identifier,
				value: value
			};
		} else {
			console.log(type, node);
		}
		return rv;
	};

	ist.get_parsed_$ = function (node, options) {
		var parsed_value = ist.get_parsed_val(node, _.extend({
			get_constraint: true,
			auto_add_dependency: true
		}, options));
		return parsed_value;
	};

	var func_regex = new RegExp("^\\s*function\\s*\\((\\s*[a-zA-Z$][\\w\\$]*\\s*,)*\\s*([a-zA-Z$][\\w\\$]*\\s*)?\\)\\s*{.*}\\s*$");
	var block_regex = new RegExp("^\\s*{.*}\\s*$");

	ist.parse = function (str) {
		if ((str.replace(/\n/g, "")).match(func_regex) || str.match(block_regex)) {
			str = "(" + str + ")";
		}

		try {
			return esprima.parse(str);
		} catch(e) {
			return new ist.Error({
				message: e.description
			});
		}
	};
}(interstate));

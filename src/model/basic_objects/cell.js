/*jslint nomen: true, vars: true */
/*global interstate,esprima,able,uid,console */

(function (ist) {
    "use strict";
    var cjs = ist.cjs,
        _ = ist._;
    
    ist.Cell = function (options, defer_initialization) {
		able.make_this_listenable(this);
        options = options || {};
        this._id = options.uid || uid();
        this._hash = uid.strip_prefix(this._id);
        ist.register_uid(this._id, this);
        if (defer_initialization !== true) {
            this.do_initialize(options);
        }
    };
    (function (My) {
        var proto = My.prototype;
		able.make_proto_listenable(proto);

        My.builtins = {
            "str": {
                start_with: function () { return cjs(""); },
                getter: function (me) { return me.get(); },
                setter: function (me, str) {
                    me.set(str, true);
                },
				destroy: function(me) {
					me.destroy(true);
				}
            },
            "ignore_inherited_in_first_dict": {
                "default": function () { return false; }
            },
            "contextual_values": {
                "default": function () {
                    return cjs.map({
                        equals: ist.check_pointer_equality,
                        hash: "hash"
                    });
                },
                settable: false,
                serialize: false,
				destroy: function(me) {
					me.forEach(function (value) {
						value.destroy(true);
					});
					me.destroy(true);
				}
            },
            "substantiated": {
                "default": function () { return false; },
				getter_name: "is_substantiated"
            }
        };
        ist.install_proto_builtins(proto, My.builtins);
        proto.do_initialize = function (options) {
            ist.install_instance_builtins(this, options, My);
            this._tree = cjs(function () {
                var str = this.get_str();
                return ist.parse(str);
            }, {
				context: this
			});
			this._is_static = cjs(function () {
				var tree = this._tree.get();
				return tree.body.length === 0 ||
					(tree.body.length === 1 &&
						tree.body[0].type === 'ExpressionStatement' &&
						tree.body[0].expression.type === 'Literal');
			}, {
				context: this
			});
			this._static_value = cjs(function() {
				var tree = this._tree.get();
				if(tree.body.length > 0) {
					return tree.body[0].expression.value;
				}
			}, {
				context: this
			});
        };
		proto.substantiate = function() {
			this.set_substantiated(true);
			this._emit("substantiated");
		};
		proto.clone = function() {
			return new ist.Cell({
				str: this.get_str()
			});
		};
		proto.emit_begin_destroy = function() {
			this._emit("begin_destroy");
		};
    
        proto.get_ignore_inherited_in_contexts = function (pcontext) {
            var i;
            if (this.get_ignore_inherited_in_first_dict()) {
                for (i = pcontext.length() - 1; i >= 0; i -= 1) {
                    var item = pcontext.points_at(i);
                    if (item instanceof ist.Dict) {
                        return [item];
                    }
                }
            }
            return [];
        };
    
	/*
        proto.get_value = function (pcontext) {
			if(this._is_static.get()) {
				console.log("STATIC!");
				return this._static_value.get();
			} else {
				var tree = this._tree.get();
				if(tree instanceof ist.Error) {
					return undefined;
				} else {
					var parsed_$ = ist.get_parsed_val(tree, {
						context: pcontext,
						ignore_inherited_in_contexts: this.get_ignore_inherited_in_contexts(pcontext)
					});
					if(parsed_$ instanceof ist.MultiExpression) {
						return parsed_$.last();
					} else {
						return parsed_$;
					}
				}
			}
        };
		*/
		proto.get_syntax_errors = function() {
            var tree = this._tree.get();
			return tree instanceof ist.Error ? [tree.message()] : [];
		};
        proto.constraint_in_context = function (pcontext) {
			if(this._is_static.get()) {
				return this._static_value.get();
			} else {
				var tree = this._tree.get();
				return ist.get_parsed_$(tree, {
							context: pcontext,
							ignore_inherited_in_contexts: this.get_ignore_inherited_in_contexts(pcontext),
							get_constraint: true
						});
			}
        };
        proto.destroy = function () {
			if(this.sid() === 7) debugger;
			this.emit_begin_destroy();
            this._tree.destroy(true);
			delete this._tree;
			this._static_value.destroy(true);
			delete this._static_value;
			this._is_static.destroy(true);
			delete this._is_static;

			ist.unset_instance_builtins(this, My);
			ist.unregister_uid(this.id());
			this._emit("destroyed");
			able.destroy_this_listenable(this);
			this._destroyed = true;
        };
    
        proto.id = function () { return this._id; };
		proto.hash = function () { return this._hash; };
		proto.sid = function() { return parseInt(uid.strip_prefix(this.id()), 10); };
    
        proto.summarize = function () {
            return this.id();
        };
    
        ist.register_serializable_type("cell",
            function (x) {
                return x instanceof My;
            },
            function (include_uid) {
                var rv = { };
                if (include_uid) { rv.uid = this.id(); }

                _.each(My.builtins, function (builtin, name) {
                    if (builtin.serialize !== false) {
                        var getter_name = builtin.getter_name || "get_" + name;
                        rv[name] = ist.serialize(this[getter_name]());
                    }
                }, this);

                return rv;
            },
            function (obj) {
                var rest_args = _.rest(arguments);
                
                var serialized_options = {};
                _.each(My.builtins, function (builtin, name) {
                    if (builtin.serialize !== false) {
                        serialized_options[name] = obj[name];
                    }
                });

                var rv = new My({uid: obj.uid}, true);
                rv.initialize = function () {
                    var options = { };
                    _.each(serialized_options, function (serialized_option, name) {
                        options[name] = ist.deserialize.apply(ist, ([serialized_option]).concat(rest_args));
                    });
                    this.do_initialize(options);
                };

                return rv;
            });
    }(ist.Cell));
}(interstate));

/*jslint nomen: true, vars: true */
/*global red,esprima,able,uid,console,window */

(function (red) {
	"use strict";
	var cjs = red.cjs,
		_ = red._;

	function isInDOMTree (node) {
		// If the farthest-back ancestor of our node has a "body"
		// property (that node would be the document itself), 
		// we assume it is in the page's DOM tree.
		return !!(findUltimateAncestor(node).body);
	}
	function findUltimateAncestor (node) {
		// Walk up the DOM tree until we are at the top (parentNode 
		// will return null at that point).
		// NOTE: this will return the same node that was passed in 
		// if it has no ancestors.
		var ancestor = node;
		while (ancestor.parentNode) {
			ancestor = ancestor.parentNode;
		}
		return ancestor;
	}

	var insert_at = function (child_node, parent_node, index) {
		var children = parent_node.childNodes;
		if (children.length <= index) {
			parent_node.appendChild(child_node);
		} else {
			var before_child = children[index];
			parent_node.insertBefore(child_node, before_child);
		}
	};
	var remove = function (child_node) {
		var parent_node = child_node.parentNode;
		if (parent_node) {
			parent_node.removeChild(child_node);
		}
	};
	var move = function (child_node, from_index, to_index) {
		var parent_node = child_node.parentNode;
		if (parent_node) {
			if (from_index < to_index) { //If it's less than the index we're inserting at...
				to_index += 1; //Increase the index by 1, to make up for the fact that we're removing me at the beginning
			}
			insert_at(child_node, parent_node, to_index);
		}
	};

	red.DomAttachmentInstance = function (options) {
		red.DomAttachmentInstance.superclass.constructor.apply(this, arguments);

		this.type = "dom";
		this.id = _.uniqueId();
		if (options.tag) {
			this._dom_obj = window.document.createElement(options.tag);
			this._dom_obj.__red_contextual_object__ = this.contextual_object;
		} else {
			this._dom_obj = cjs.$();
			this._tag_change_listener = this.add_tag_change_listener();
		}

		this._css_change_listener = this.add_css_change_listeners();
		this._attr_change_listener = this.add_attribute_change_listeners();

		this._children_change_listener = this.add_children_change_listener();
		this.current_children_srcs = [];

		this.pause();
		this.on_ready();
	};
	(function (my) {
		_.proto_extend(my, red.AttachmentInstance);
		var proto = my.prototype;
		proto.get_owner = function () {
			return this._owner;
		};
		proto.on_ready = function () {
		};
		proto.destroy = function () {
			if (_.has(this, "_tag_change_listener")) { this._tag_change_listener.destroy(); }
			if (_.has(this, "_css_change_listener")) { this._css_change_listener.destroy(); }
			if (_.has(this, "_attr_change_listener")) { this._attr_change_listener.destroy(); }
			if (_.has(this, "_css_change_listeners")) {
				_.each(this._css_change_listeners, function (x) {
					x.destroy();
				});
			}
			if (_.has(this, "_attr_change_listeners")) {
				_.each(this._attr_change_listeners, function (x) {
					x.destroy();
				});
			}
			if (_.has(this, "_children_change_listener")) { this._children_change_listener.destroy(); }
		};
		proto.get_dom_obj = function () {
			if (_.has(this, "_tag_change_listener")) { this._tag_change_listener.run(); }
			var rv = cjs.get(this._dom_obj);
			return rv;
		};

		proto.add_tag_change_listener = function () {
			var contextual_object = this.get_contextual_object();

			var old_tag;
			return cjs.liven(function () {
				var tag = contextual_object.prop_val("tag");
				if (tag !== old_tag) {
					old_tag = tag;
					if (_.isString(tag)) {
						var dom_obj = window.document.createElement(tag);
						dom_obj.__red_contextual_object__ = contextual_object;
						this._dom_obj.set(dom_obj);
					} else {
						this._dom_obj.set(undefined);
					}
				}
			}, {
				context: this,
				pause_while_running: true,
				run_on_create: false
			}).run();
		};

		proto.add_css_change_listeners = function () {
			var contextual_object = this.get_contextual_object(),
				current_listener_prop_names = [],
				current_listeners = {},
				desired_listener_prop_names;
			this._css_change_listeners = current_listeners;

			return cjs.liven(function () {
				var children;
				var css = contextual_object.prop("css");
				var child_vals = {};
				if (css instanceof red.ContextualDict) {
					children = css.children(true);
					var prop_names = _.pluck(children, "name");
					_.each(children, function (child) {
						child_vals[child.name] = child.value;
					});
					desired_listener_prop_names = prop_names;
				} else {
					children = [];
					desired_listener_prop_names = [];
				}

				var diff = _.diff(current_listener_prop_names, desired_listener_prop_names);
				current_listener_prop_names = desired_listener_prop_names;

				var dom_obj;
				if (diff.removed.length > 0) {
					dom_obj = this.get_dom_obj();
				}

				_.each(diff.removed, function (info) {
					var name = info.from_item;
					var listener = current_listeners[name];
					listener.destroy();
					delete diff.removed[name];
					if (dom_obj) {
						dom_obj.style[name] = "";
						delete dom_obj.style[name];
					}
				}, this);
				_.each(diff.added, function (info) {
					var name = info.item;
					current_listeners[name] = this.add_css_change_listener(name, child_vals[name]);
				}, this);
			}, {
				context: this,
				pause_while_running: true
			});
		};
		proto.add_css_change_listener = function (name, child_val) {
			var contextual_object = this.get_contextual_object();

			return cjs.liven(function () {
				var dom_obj = this.get_dom_obj();
				if (dom_obj) {
					var val = child_val.val();
					if (val) {
						dom_obj.style[name] = val.toString();
					} else {
						dom_obj.style[name] = "";
						delete dom_obj.style[name];
					}
				}
			}, {
				context: this,
				pause_while_running: true
			});
		};
		proto.add_attribute_change_listeners = function () {
			var contextual_object = this.get_contextual_object(),
				current_listener_prop_names = [],
				current_listeners = {},
				desired_listener_prop_names;

			this._attr_change_listeners = current_listeners;

			return cjs.liven(function () {
				var css = contextual_object.prop("attr");
				var child_vals = {};
				var children;
				if (css instanceof red.ContextualDict) {
					children = css.children(true);
					var prop_names = _.pluck(children, "name");
					_.each(children, function (child) {
						child_vals[child.name] = child.value;
					});
					desired_listener_prop_names = prop_names;
				} else {
					children = [];
					desired_listener_prop_names = [];
				}

				var diff = _.diff(current_listener_prop_names, desired_listener_prop_names);
				current_listener_prop_names = desired_listener_prop_names;

				var dom_obj;
				if (diff.removed.length > 0) {
					dom_obj = this.get_dom_obj();
				}

				_.each(diff.removed, function (info) {
					var name = info.from_item;
					var listener = current_listeners[name];
					listener.destroy();
					delete diff.removed[name];
					if (dom_obj) {
						dom_obj.style[name] = "";
						delete dom_obj.style[name];
					}
				}, this);
				_.each(diff.added, function (info) {
					var name = info.item;
					current_listeners[name] = this.add_attribute_change_listener(name, child_vals[name]);
				}, this);
			}, {
				context: this,
				pause_while_running: true
			});
		};
		proto.add_attribute_change_listener = function (name, child_val) {
			var contextual_object = this.get_contextual_object();

			return cjs.liven(function () {
				var dom_obj = this.get_dom_obj();
				if (dom_obj) {
					var val = child_val.val();
					if (val) {
						dom_obj.setAttribute(name, val);
					} else {
						dom_obj.removeAttribute(name);
					}
				}
			}, {
				context: this,
				pause_while_running: true
			});
		};

		var get_dom_obj_and_src = function (contextual_dict) {
			var dom_obj;
			var dom_attachment = contextual_dict.get_attachment_instance("dom");
			if (dom_attachment) {
				dom_obj = dom_attachment.get_dom_obj();
				if(dom_obj) {
					return [dom_attachment, dom_obj];
				}
			}
			return false;
		};

		proto.is_paused = function() {
			return this._paused;
		};

		proto.pause = function () {
			this._paused = true;
			if (_.has(this, "_tag_change_listener")) { this._tag_change_listener.pause(); }
			if (_.has(this, "_css_change_listener")) { this._css_change_listener.pause(); }
			if (_.has(this, "_attr_change_listener")) { this._attr_change_listener.pause(); }
			if (_.has(this, "_css_change_listeners")) {
				_.each(this._css_change_listeners, function (x) {
					x.pause();
				});
			}
			if (_.has(this, "_attr_change_listeners")) {
				_.each(this._attr_change_listeners, function (x) {
					x.pause();
				});
			}
			if (_.has(this, "_children_change_listener")) { this._children_change_listener.pause(); }

			var children_srcs = this.current_children_srcs;
			_.each(children_srcs, function(child_src) {
				if (child_src instanceof red.DomAttachmentInstance) {
					child_src.pause();
				} else if(_.isElement(child_src)) {
					var pause_fn = $(child_src).data("pause");
					if(pause_fn) {
						pause_fn();
					}
				}
			});
		};

		proto.resume = function () {
			this._paused = false;
			if (_.has(this, "_tag_change_listener")) { this._tag_change_listener.resume(); }
			if (_.has(this, "_css_change_listener")) { this._css_change_listener.resume(); }
			if (_.has(this, "_attr_change_listener")) { this._attr_change_listener.resume(); }
			if (_.has(this, "_css_change_listeners")) {
				_.each(this._css_change_listeners, function (x) {
					x.resume();
					x.run();
				});
			}
			if (_.has(this, "_attr_change_listeners")) {
				_.each(this._attr_change_listeners, function (x) {
					x.resume();
					x.run();
				});
			}
			if (_.has(this, "_children_change_listener")) { this._children_change_listener.resume(); }

			if (_.has(this, "_tag_change_listener")) { this._tag_change_listener.run(); }
			if (_.has(this, "_css_change_listener")) { this._css_change_listener.run(); }
			if (_.has(this, "_attr_change_listener")) { this._attr_change_listener.run(); }

			if (_.has(this, "_children_change_listener")) { this._children_change_listener.run(); }
			var children_srcs = this.current_children_srcs;
			_.each(children_srcs, function(child_src) {
				if (child_src instanceof red.DomAttachmentInstance) {
					child_src.resume();
				} else if(_.isElement(child_src)) {
					var resume_fn = $(child_src).data("resume");
					if(resume_fn) {
						resume_fn();
					}
				}
			});
		};

		proto.on_remove = function() {
			var dom_obj = this.get_dom_obj();
			if (!dom_obj || !isInDOMTree(dom_obj)) {
				this.pause();
			}
		};

		proto.on_add = function() {
			var dom_obj = this.get_dom_obj();

			if (dom_obj && isInDOMTree(dom_obj)) {
				this.resume();
			}
		};

		proto.add_children_change_listener = function () {
			var contextual_object = this.get_contextual_object();

			var cc = cjs.liven(function () {
				var dom_obj = this.get_dom_obj();
				if (!_.isElement(dom_obj)) {
					return;
				}
				var text;

				if (contextual_object.has("text")) {
					text = contextual_object.prop_val("text");
				}
				
				if (text !== undefined) {
					dom_obj.textContent = text;
				} else {
					var children = contextual_object.prop("child_nodes");

					var current_children = _.toArray(dom_obj.childNodes);
					var desired_children_srcs = [];
					var desired_children = [];

					if (children) {
						var cc;
						if (children instanceof red.ContextualDict) {
							cc = _.pluck(children.children(true), "value");
						} else if (children instanceof red.ContextualObject) {
							cc = children.val();
							if (!_.isArray(cc)) {
								cc = [cc];
							}
						}

						_.each(cc, function (c) {
							if (_.isElement(c)) {
								desired_children.push(c);
							} else if (c instanceof red.ContextualDict) {
								if (c.is_template()) {
									var instances = c.instances();
									var cs_and_dom_objs = _.chain(instances)
										.map(get_dom_obj_and_src)
										.compact()
										.value();

									var obj_srcs = _.pluck(cs_and_dom_objs, 0);
									var dom_objs = _.pluck(cs_and_dom_objs, 1);

									desired_children_srcs.push.apply(desired_children_srcs, obj_srcs);
									desired_children.push.apply(desired_children, dom_objs);
								} else {
									var dom_obj_and_src = get_dom_obj_and_src(c);
									if (dom_obj_and_src) {
										desired_children_srcs.push(dom_obj_and_src[0]);
										desired_children.push(dom_obj_and_src[1]);
									}
								}
							}
						}, this);
					}

					var diff = _.diff(current_children, desired_children);
					_.forEach(diff.removed, function (info) {
						var index = info.from, child = info.from_item;
						var src = this.current_children_srcs[index];

						remove(child);
						if(src instanceof red.DomAttachmentInstance) {
							src.on_remove();
						} else if(_.isElement(src)) {
							var pause_fn = $(src).data("pause");
							if(pause_fn) {
								pause_fn();
							}
						}
					}, this);
					_.forEach(diff.added, function (info) {
						var index = info.to, child = info.item;
						var src = desired_children_srcs[index];

						insert_at(child, dom_obj, index);

						if(src instanceof red.DomAttachmentInstance) {
							src.on_add();
						} else if(_.isElement(src)) {
							var resume_fn = $(src).data("resume");
							if(resume_fn) {
								resume_fn();
							}
						}
					}, this);
					_.forEach(diff.moved, function (info) {
						var from_index = info.from, to_index = info.to, child = info.item;
						move(child, from_index, to_index);
					}, this);
					this.current_children_srcs = desired_children_srcs;
				}
			}, {
				context: this,
				pause_while_running: true
			});
			return cc;
		};
	}(red.DomAttachmentInstance));

	red.DomAttachment = function (options) {
		options = _.extend({
			instance_class: red.DomAttachmentInstance
		}, options);
		red.DomAttachment.superclass.constructor.call(this, options);
		this.type = "dom";
	};
	(function (My) {
		_.proto_extend(My, red.Attachment);
		var proto = My.prototype;

		red.register_serializable_type("dom_attachment",
			function (x) {
				return x instanceof My;
			},
			function () {
				return {
					instance_options: red.serialize(this.instance_options)
				};
			},
			function (obj) {
				return new My({
					instance_options: red.deserialize(obj.instance_options)
				});
			});
	}(red.DomAttachment));

	red.define("dom_attachment", function (options) {
		return new red.DomAttachment(options);
	});
}(red));

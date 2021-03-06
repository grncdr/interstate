/*jslint nomen: true, vars: true, white: true */
/*jshint scripturl: true */
/*global interstate,esprima,able,uid,console,window,jQuery,Raphael */

(function (ist, $) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	$.widget("interstate.copy", {
		options: {
			curr_copy: false,
			out_of: 0,
			client: false,
			displayed: false
		},

		_create: function () {
			var client = this.option("client");
			client.signal_interest();
			this.left_brace = $("<span />").text(" [").addClass("brace");
			this.content = $("<span />");
			this.right_brace = $("<span />").text("]").addClass("brace");

			this.curr_copy_text = $("<span />")	.addClass("copy_num");
			this.of_text = $("<span />")	.addClass("of_text");

			this.content.append(this.curr_copy_text, this.of_text);

			this.element.addClass("copy");

			if(this.option("displayed")) {
				this.on_displayed();
			}

			this.content.on("click.on_click", _.bind(this.on_click, this));
			this.add_listener();
		},

		_destroy: function () {
			this.destroy_copy_num_input();
			this.content.off("click.on_click");
			this._super();
			this.remove_listener();
			var client = this.option("client");
			client.signal_destroy();
			delete this.options.client;
			delete this.options;
		},

		on_click: function() {
			this.copy_num_input = $("<input />").attr({
													type: "number",
													min: 0,
													max: this.option("out_of")
												})
												.val(this.option("curr_copy"))
												.addClass("copy_input")
												.insertBefore(this.content)
												.focus()
												.select()
												.on("blur.on_blur", _.bind(this.on_blur, this))
												.on("change.on_change", _.bind(this.on_change, this))
												.on("keydown.on_keydown", _.bind(this.on_key_down, this));

			this.original_copy_num = this.option("curr_copy");
			this.content.hide();
		},

		destroy_copy_num_input: function() {
			if(this.copy_num_input) {
				this.copy_num_input	.off("blur.on_blur")
									.off("change.on_change")
									.off("keydown.on_keydown")
									.remove();
				delete this.copy_num_input;
			}
		},

		on_blur: function() {
			this.destroy_copy_num_input();
			this.content.show();
		},

		on_change: function(event) {
			var value = parseInt(this.copy_num_input.val(), 10);
			this.option("curr_copy", value);
		},

		on_key_down: function(jqEvent) {
			var event = jqEvent.originalEvent;
			if(event.keyCode === 13) { // Enter
				this.on_change();
				this.on_blur();
			} else if(event.keyCode === 27) { // Esc
				this.on_blur();
				this.option("curr_copy", this.original_copy_num);
			}
		},

		add_listener: function() {
			var client = this.option("client");
			var $is_template = client.get_$("is_template");
			var $copies = client.get_$("instances");
			this.copy_listener = cjs.liven(function() {
				var is_template = $is_template.get();
				if(is_template) {
					var copies = $copies.get();
					if(_.isArray(copies)) {
						var len = copies.length;
						this.option({
							displayed: true,
							out_of: len-1,
							curr_copy: Math.min(this.option("curr_copy"), len)
						});
					} else {
						this.option({
							displayed: false
						});
					}
				} else {
					this.option({
						displayed: false
					});
				}
			}, {
				context: this,
				on_destroy: function() {
					$is_template.signal_destroy();
					$copies.signal_destroy();
				}
			});
		},
		remove_listener: function() {
			if(this.copy_listener) {
				this.copy_listener.destroy();
				delete this.copy_listener;
			}
		},

		update_display: function() {
			if(this.option("curr_copy") === false) {
				this.curr_copy_text.text("");
				this.of_text.text(this.option("out_of"));
			} else  {
				this.curr_copy_text.text(this.option("curr_copy"));
				this.of_text.text(" , length " + (this.option("out_of") + 1));
			}
		},

		on_displayed: function() {
			this.update_display();
			this.element.append(this.left_brace, this.content, this.right_brace);
		},

		on_not_displayed: function() {
			this.element.children().remove();
		},

		_setOption: function(key, value) {
			var old_value;
			if(key === "curr_copy" || key === "out_of") {
				old_value = this.option(key);
			}
			this._super(key, value);
			if(key === "displayed") {
				if(value) {
					this.on_displayed();
				} else {
					this.on_not_displayed();
				}
			} else if(key === "curr_copy" || key === "out_of") {
				if(old_value !== value) {
					if(key === "curr_copy") {
						this.element.trigger("curr_copy_change", value);
					}
					this.update_display();
				}
			}

		}
	});
}(interstate, jQuery));

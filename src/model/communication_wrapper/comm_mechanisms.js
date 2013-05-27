/*jslint nomen: true, vars: true */
/*global red,esprima,able,uid,console,window */

(function (red) {
	"use strict";
	var cjs = red.cjs,
		_ = red._,
		origin = window.location.protocol + "//" + window.location.host;
	
	red.InterWindowCommWrapper = function(remote_window, client_id) {
		able.make_this_listenable(this);
		this.remote_window = remote_window;
		this.client_id = client_id;

		this.$on_message = _.bind(this.on_message, this);
		window.addEventListener("message", this.$on_message);
	};

	(function(My) {
		var proto = My.prototype;
		able.make_proto_listenable(proto);
		proto.on_message = function(event) {
			if(event.source === this.remote_window) {
				var data = event.data;
				if(data.client_id === this.client_id) {
					var message = data.message;
					this._emit("message", message);
				}
			}
		};
		proto.post = function(message) {
			this.remote_window.postMessage({
				message: message,
				client_id: this.client_id
			}, origin);
		};
		proto.destroy = function() {
			window.removeEventListener("message", this.$on_messsage);
		};
	}(red.InterWindowCommWrapper));


	var same_window_comm_wrappers = [];
	red.SameWindowCommWrapper = function(client_id) {
		able.make_this_listenable(this);
		this.client_id = client_id;
		same_window_comm_wrappers.push(this);
	};

	(function(My) {
		var proto = My.prototype;
		able.make_proto_listenable(proto);

		proto.post = function(message) {
			var len = same_window_comm_wrappers.length;
			var my_client_id = this.client_id;
			
			for(var i = 0; i<len; i++) {
				var same_window_comm_wrapper = same_window_comm_wrappers[i];
				if(this !== same_window_comm_wrapper &&
					same_window_comm_wrapper.client_id === my_client_id) {
					same_window_comm_wrapper.on_message(message);
				}
			}
		};

		proto.on_message = function(message) {
			_.defer(_.bind(function() {
			this._emit("message", message);
			}, this));
		};

		proto.destroy = function() {
			for(var i = 0; i<same_window_comm_wrappers.length; i++) {
				if(same_window_comm_wrappers[i] === this) {
					same_window_comm_wrappers.splice(i, 1);
					i--;
				}
			}
		};
	}(red.SameWindowCommWrapper));
}(red));

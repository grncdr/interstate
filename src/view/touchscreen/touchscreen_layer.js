/*jslint nomen: true, vars: true, white: true */
/*jshint scripturl: true */
/*global interstate,esprima,able,uid,console,window,jQuery,Raphael */

(function (ist, $) {
	"use strict";
	var cjs = ist.cjs,
		_ = ist._;

	$.widget("interstate.touchscreen_layer", {
		options: {
		},
		_create: function () {
			this._super();

			this.raphaelDiv = $("<div />").prependTo(document.body).css({
				"pointer-events": "none",
				"position": "absolute"
			});
			this.canvasDiv = $("<canvas />").prependTo(document.body).css({
				"pointer_events": "none",
				"position": "absolute"
			});

			this.paper = Raphael(this.raphaelDiv[0]);
			this.ctx = this.canvasDiv[0].getContext("2d");

			var onWindowResize = _.bind(function() {
				this.paper.setSize(window.innerWidth, window.innerHeight);
				this.canvasDiv.css({
					width: window.innerWidth+'px',
					height: window.innerHeight+'px'
				}).attr({
					width: window.innerWidth,
					height: window.innerHeight
				});
			}, this);

			$(window).on('resize.touchscreen_layer', onWindowResize);
			onWindowResize();

			this.touch_clusters = [];
			this.path_views = [];
		},
		_destroy: function () {
			this._super();
			$(window).off('resize.touchscreen_layer');

			this.clearTouchClusters();
			this.clearPaths();

			this.paper.clear();
			this.raphaelDiv.remove();
			this.canvasDiv.remove();
		},
		addPath: function(toAdd) {
			var pathView = $(this.element).svg_path({
				path: toAdd,
				ctx: this.ctx,
				paper: this.paper,
				pathAttributes: {
					fill: "red"
				}
			});
			this.path_views.push(pathView);
		},
		removePath: function(path) {
			for(var i = 0; i<this.path_views.length; i++) {
				var pView = this.path_views[i];
				if(pView.option("path") === path) {
					pView.svg_path("destroy");
					this.path_views.splice(i, 1);
					i--;
				}
			}
		},
		clearPaths: function() {
			for(var i = 0; i<this.path_views.length; i++) {
				var pView = this.path_views[i];
				pView.svg_path("destroy");
			}
		},
		addTouchCluster: function(cluster) {
			var touchClusterView = $(this.element).touch_cluster({
				cluster: cluster,
				ctx: this.ctx,
				paper: this.paper
			});
			this.touch_clusters.push(touchClusterView);
		},
		removeTouchCluster: function(cluster) {
			for(var i = 0; i<this.touch_clusters.length; i++) {
				var tcView = this.touch_clusters[i];
				if(tcView.option("cluster") === cluster) {
					tcView.touch_cluster("destroy");
					this.touch_clusters.splice(i, 1);
					i--;
				}
			}
		},
		clearTouchClusters: function() {
			for(var i = 0; i<this.touch_clusters.length; i++) {
				var tcView = this.touch_clusters[i];
				tcView.touch_cluster("destroy");
			}
		}
	});
}(interstate, jQuery));
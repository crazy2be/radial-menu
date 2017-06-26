// kate: indent-width: 2;
;(function (window) {
  "use strict";

  function merge(...objs) {
    var res = {};
    objs.forEach(obj => {for (var key in obj) { res[key] = obj[key]; }});
    return res;
  }

  function setAttrs(el, obj) { for (var k in obj) { el.setAttribute(k, obj[k]); }}

  function createElem(parent, kind, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
    if (attrs) setAttrs(node, attrs);
    if (parent) parent.appendChild(node);
    return node;
  }
  // For some reason svg textpaths must be created in a seperate element,
  // and linked to with a href. Don't ask me why this is the system they have,
  // but it is.
  function defsPath(svg, path) {
    var hash32 = s => s.reduce((a,b) => (a = ((a<<5)-a)+b.charCodeAt(0), a&a), 0);
    var hash = s => hash32(s).toString(36) + hash32(s.slice().reverse()).toString(36);

    var pathID = 'path' + hash(path.split(""));
    if (svg.querySelector("#" + pathID)) return pathID;

    var defs = svg.querySelector("defs") || createElem(svg, "defs");
    createElem(defs, "path", {d: path, id: pathID});
    return pathID;
  }

  function polarToCartesian(r, angleInDegrees) {
    var theta = angleInDegrees * Math.PI / 180.0;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }

  function describeArc(radius, startAngle, endAngle, sweep) {
    var start = polarToCartesian(radius, endAngle);
    var end = polarToCartesian(radius, startAngle);
    var largeArcFlag = Math.abs(endAngle - startAngle) > 180;
    return [
      start.x, start.y,
      "A", radius, radius, 0, ~~largeArcFlag, ~~sweep, end.x, end.y];
  }

  var radialMenu = function (options) {
    var defaults = {
      "spacing": 10, // amount of space between menu items
      "start-radius": 50,
      "onclick": null,
      "class": "",
      "background-style": "",
      "text-style": "",
      "size": 1,
      "insert-at": document.body,
      "deg-start": 90,
    };
    this.options = merge(defaults, options);
    this.init();
    this.svg = createElem(this.options["insert-at"], "svg",
          {style: "position: absolute; left:0; top:0; margin:0;"});
    this.svg.classList.add('radial-menu');
    this.mainGroup = createElem(this.svg, "g");
  };

  radialMenu.prototype = {
    init: function () {
      this.childs = [];
      this.items = [];
    },

    open: function () {
      this.svg.style.display = '';
      if (this.parent) {
        this.parent.items.forEach(el => el.classList.remove('open'));
        var index = this.parent.childs.indexOf(this);
        this.parent.items[index].classList.add('open');
      }
      if (this.g) {
        this.g.style.display = '';
        return;
      }
      this.buildChildren();
    },

    openAt: function (x, y) {
      this.open();
      this.svg.style.left = x + 'px';
      this.svg.style.top = y + 'px';
    },

    buildChildren: function () {
      this.radiusSmall = this.parent ? this.parent.radiusBig + 10 : this.options["start-radius"];
      this.radiusBig = this.radiusSmall + 50;
      this.g = createElem(this.mainGroup, "g");

      var sum = a => a.reduce((n, i) => n + i, 0);
      var totalSize = sum(this.childs.map(c => c.options.size));
      var deg = this.options['deg-start'], steps = [deg];
      for (var i = 0; i < this.childs.length; i++) {
        deg += this.childs[i].options.size * (360 / totalSize);
        steps.push(deg);
      }

      for (let i = 0; i < this.childs.length; i++) {
        let opts = this.childs[i].options;
        var item = createElem(this.g, "g")
        if (opts.class) item.classList.add(opts.class);
        this.items.push(item);

        // ### Background
        var circ = r => 2*Math.PI*r;
        var spaceDeg = (this.options.spacing/2) * 360;
        var spaceBig = spaceDeg / circ(this.radiusBig);
        var spaceSmall = spaceDeg / circ(this.radiusSmall);
        var background = createElem(item, "path", {
          d: [].concat(
            "M", describeArc(this.radiusBig, steps[i] + spaceBig, steps[i+1] - spaceBig, false),
            "L", describeArc(this.radiusSmall, steps[i+1] - spaceSmall, steps[i] + spaceSmall, true),
            "Z").join(" "),
          "cursor": "pointer",
          "style": opts["background-style"],
        })
        background.onclick = (ev) => {
          this.childs[i].open(i);
          if (opts.onclick) opts.onclick(ev);
        };

        // ### Text
        var text = createElem(item, "text", {
          "text-anchor": "middle",
          "pointer-events": "none",
          "alignment-baseline": "baseline",
          "style": opts["text-style"],
        });

        var radiusMid = (this.radiusBig + this.radiusSmall) / 2;
        var start = steps[i], end = steps[i+1], sweep = end > 180;
        if (sweep) [start, end] = [end, start];
        var textPath = createElem(text, "textPath", {
          "href": "#" + defsPath(this.svg, ["M"].concat(describeArc(radiusMid, start, end, sweep)).join(" ")),
          "startOffset": "50%",
          "alignment-baseline": "middle",
        });
        textPath.appendChild(document.createTextNode(this.childs[i].label));
      }
      this.recomputeBounds();
    },

    closeAllChildren: function () { this.childs.forEach(el => el.close()); },

    close: function () {
      if (this.g) this.g.style.display = "none";
      if (!this.parent) this.svg.style.display = "none";
      this.closeAllChildren();
    },

    recomputeBounds: function () {
      if (!this.childs.length) return;

      var bbox = this.g.getBBox(), w = bbox.width + 100, h = bbox.height + 100;
      var cw = parseInt(this.svg.getAttribute('width')) || 0;
      var ch = parseInt(this.svg.getAttribute('height')) || 0;
      if (cw >= w && ch >= h) return;

      setAttrs(this.svg, {width: w+"px", height: h+"px"});
      this.svg.style.marginLeft = (-w/2)+'px';
      this.svg.style.marginTop = (-h/2)+'px';
      setAttrs(this.mainGroup, {transform: 'translate('+w/2+','+h/2+')'});
    },

    /** method to add children */
    add: function (label, options) {
      var child = new myMenuItem(label, merge(this.options, options), this);
      this.childs.push(child);
      return child;
    }
  };

  /** myMenuItem constructor */
  var myMenuItem = function (label, options, parent) {
    this.label = label;
    this.options = options;
    this.parent = parent;

    // menuItem SVG elements
    this.svg = this.parent.svg;
    this.mainGroup = this.parent.mainGroup;

    this.init();
  };

  myMenuItem.prototype = radialMenu.prototype;

  window.radialMenu = radialMenu;
})(window);

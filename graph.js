// GRAPH JS =================================================================================================================
// By Andy Graulund + David Kofoed Wind

// Basic stuff --------------------------------------------------------------------------------------------------------------
var n        = "number", 
    s        = "string", 
    o        = "object", 
    b        = "boolean", 
    u        = "undefined", 
    uimode   = 0,
    dragging = false, moved = false, dp = [null,null],
    selected = [],
    hovered  = null
var touch    = "createTouch" in document
var w        = 640,
    h        = 480,
    cid      = 100
var click    = touch ? "tap" : "click"
var vertices = [],
    edges    = [],
    graphs   = [],
	states   = [], // For undos/redos
    gi       = 0 // Current graph (index)
var ce       = null,
    canvas   = null,
    cx       = null


// Utility functions --------------------------------------------------------------------------------------------------------

function iu(x){ return typeof x == u }
function dlog(x){ if("console" in window && window.console.log){ console.log(x) } }
function oc(a){ var o = {}; for(var i=0;i<a.length;i++){ o[a[i]] = ""; } return o }
function he(str){ return str.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;") } // Special HTML chars encode
function re(str){ return str.toString().replace(/&quot;/g, "\"").replace(/&#039;/, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") } // Special HTML chars decode
function ucf(str){ str += ""; var f = str.charAt(0).toUpperCase(); return f + str.substr(1) } // Upper case first letter
function noevt(evt){ evt.preventDefault() }

function inArray(v, array){
	for(var e in array){
		if(array[e] === v){
			return true
		}
	}
	return false
}

function listRemove(list, val){
	for(var i = 0; i < list.length; i++){
		if(list[i] == val){
			list.splice(i, 1)
		}
	}
} // oh god what did i do i am a terrible person


// Style --------------------------------------------------------------------------------------------------------------------

function ElementStyle(strokecolor, fillcolor, strokewidth, vertexradius){
	if(typeof strokewidth  != n || strokewidth  <= 0){ strokewidth  = 1.2 }
	if(typeof vertexradius != n || vertexradius <= 0){ vertexradius = 4 }
	this.id           = ++cid
	this.shape        = "circle"
	this.strokecolor  = strokecolor
	this.fillcolor    = fillcolor
	this.strokewidth  = strokewidth
	this.vertexradius = vertexradius
	
	this.toTikZ       = function(){
		// TODO: convert colors
		return "\\tikzstyle{style" + this.id + "}=[" + this.shape + ",fill=" + this.fillcolor + ",draw=" + this.strokecolor + ",line width=" + this.strokewidth + "]"
	}
}

function styleContext(cx, style, fill){
	if(typeof fill != b){ fill = true }
	cx.strokeStyle = style.strokecolor
	if(fill){ cx.fillStyle = style.fillcolor }
	cx.lineWidth   = style.strokewidth
}

var defaultStyle  = new ElementStyle("#000", "#fff")
var selectedStyle = new ElementStyle("rgba(39,166,255,0.5)", "transparent", 4)
var labelStyle    = new ElementStyle("transparent", "#fff", 0)


// The classes --------------------------------------------------------------------------------------------------------------

function Graph(vertices, edges){
	if(typeof vertices == u){ vertices = [] }
	if(typeof vertices != o){ return false }
	if(typeof edges == u){ edges = [] }
	if(typeof edges != o){ return false }
	this.vertices = vertices
	this.edges    = edges
	this.x        = 0 // An offset?
	this.y        = 0
	this.visible  = true
	
	this.draw     = function(cx){
		if(cx != null){
			dlog(["Drawing graph"])
			var edgegroups = this.edgeGroups(), g
			dlog(edgegroups)
			//console.trace()
			for(var s in edgegroups){
				g = edgegroups[s]
				for(var i in g){
					dlog(["About to draw", g.length, i])
					g[i].draw(cx, g.length, i)
				}
			}
			for(var i in this.vertices){
				this.vertices[i].draw(cx)
			}
			if(selected.length <= 0 || selected[0] == this || selected[0] == null){
				displayInfo($("#info"), null, cx)
			}
		}
	}
	
	this.attach    = function(){
		this.visible = true
		graphs.push(this)
	}
	
	this.detach    = function(){
		this.visible = false
		listRemove(graphs, this)
	}
	
	this.toJSON    = function(){
		var o = { vertices: [], edges: [], x: this.x, y: this.y }
		for(var i in this.vertices){
			o.vertices.push(this.vertices[i].toJSON())
		}
		for(var i in this.edges){
			o.edges.push(this.edges[i].toJSON())
		}
		return o
	}
	
	this.toTikZ    = function(){
		var o = "\\begin{tikzpicture}\n"
		for(var i in this.vertices){
			o += "\t" + this.vertices[i].toTikZ() + "\n"
		}
		for(var i in this.edges){
			o += "\t" + this.edges[i].toTikZ()    + "\n"
		}
		o += "\\end{tikzpicture}"
		return o
	}
	
	this.degreeSeq = function(){
		var seq = [], v
		for(var i in this.vertices){
			v = this.vertices[i]
			if(v instanceof Vertex){
				seq.push(v.degree)
			}
		}
		return seq
	}
	
	this.addVertex = function(v, cx){
		if(v instanceof Array && v.length == 2){
			v = new Vertex(cid++, "", v[0], v[1])
		}
		if(!(v instanceof Vertex)){
			v = new Vertex(cid++, "", (w/2 + Math.floor(Math.random()*10)), (h/2 + Math.floor(Math.random()*10)))
		}
		this.vertices.push(v)
		v.update(this)
		this.draw(cx)
		return v
	}
	
	this.addEdge   = function(e, cx){
		if(e instanceof Array && e.length == 2){
			e = new Edge(cid++, "", e[0], e[1])
		}
		if(e instanceof Edge){
			if(inArray(e.from, this.vertices) && inArray(e.to, this.vertices)){
				this.edges.push(e)
				e.update(this)
				this.draw(cx)
				return e
			}
		}
		return null
	}
	
	this.detachChild = function(el){
		var list, edges = []
		if(el instanceof Vertex){ list = this.vertices; edges = el.edges }
		else if(el instanceof Edge){ list = this.edges }
		else { return null }
		/*if(edges.length > 0){
			for(var i in edges){
				this.detachChild(edges[i])
			}
		}*/
		while(edges.length > 0){
			this.detachChild(edges[0])
		}
		el.detach()
		listRemove(list, el)
		return el
	}
	
	this.adjacencyList = function(){
		var l = [], e
		for(var i in this.edges){
			e = this.edges[i]
			l.push([e.from, e.to])
		}
		return l
	}
	
	this.adjacencyMatrix = function(mobj){
		var M = [], v, u, r
		// TODO: Better support for directed graphs and multigraphs
		for(var i in this.vertices){
			v = this.vertices[i]
			r = []
			for(var j in this.vertices){
				u = this.vertices[j]
				r.push(v.isNeighbour(u) ? 1 : 0)
			}
			M.push(r)
		}
		return mobj ? $M(M.length > 0 ? M : [0]) : M
	}
	
	this.degreeMatrix    = function(mobj){
		// Requires Sylvester
		var ds = this.degreeSeq()
		var dl = (ds.length > 0)
		var DM = dl ? Matrix.Diagonal(ds) : $M([0])
		return mobj ? DM : (dl ? DM.elements : [])
	}
	
	this.laplacianMatrix = function(mobj){
		// Requires Sylvester
		var AM = this.adjacencyMatrix(true)
		var DM = this.degreeMatrix(true)
		var LM = DM.subtract(AM)
		return mobj ? LM : LM.elements
	}
	
	this.spanningTreeCount = function(){
		// Requires Sylvester
		var LM = this.laplacianMatrix(true)
		var n  = LM.rows() - 1
		if(n > 1){
			return Math.round(LM.minor(1, 1, n, n).determinant())
		} else if(n == 1){
			return Math.round(Math.abs(LM.elements[0][0]))
		}
		return 0
	}
	
	this.edgeGroups = function(){
		var l = {}, e, name
		var n = function(a,b){ var c = (a <= b); return (c ? a : b) + "," + (c ? b : a) }
		for(var i in this.edges){
			e    = this.edges[i]
			name = n(e.from.id, e.to.id)
			if(!(name in l)){ l[name] = [] }
			l[name].push(e)
		}
		return l
	}
	
	this.complete  = function(cx){
		this.edges = []
		for(var i in this.vertices){
			v = this.vertices[i]
			if(v instanceof Vertex){
				v.edges  = []
				v.update(this)
			}
		}
		for(var i in this.vertices){
			v = this.vertices[i]
			if(v instanceof Vertex){
				for(var j in this.vertices){
					u = this.vertices[j]
					if(u instanceof Vertex){
						if(!v.isNeighbour(u) && v !== u){
							this.addEdge([v,u], cx)
						}
					}
				}
			}
		}
		drawAll(cx)
	}
	
	this.attach()
}

function Vertex(id, value, x, y){
	if(typeof id != n){ return false }
	if(typeof value != n && typeof value != s){ return false }
	if(typeof x != n || typeof y != n){ return false }
	
	this.id       = id
	this.value    = value
	this.x        = Math.round(x)
	this.y        = Math.round(y)
	this.degree   = 0
	this.edges    = []
	this.visible  = true
	this.style    = defaultStyle
	
	this.draw     = function(cx){
		this._draw(cx, this.style, true)
	}
	
	this.drawSel  = function(cx){
		this._draw(cx, selectedStyle, false)
	}
	
	this._draw    = function(cx, style, label){
		styleContext(cx, style)
		cx.beginPath()
		cx.arc(this.x, this.y, style.vertexradius, 0, 2*Math.PI, true)
		cx.closePath()
		cx.fill()
		cx.stroke()
		if(label && (typeof this.value == s || typeof this.value == n) && this.value !== ""){
			var labelOffset = 14
			styleContext(cx, labelStyle)
			cx.beginPath()
			cx.arc(this.x, this.y - labelOffset, labelStyle.vertexradius*2, 0, 2*Math.PI, true)
			cx.closePath()
			cx.fill()
			cx.stroke()
			cx.fillStyle = "#000"
			cx.fillText(this.value, this.x, this.y - labelOffset)
		}
	}
	
	/*this.drawEdges = function(cx){
		for(var i = 0; i < this.edges; i++){
			this.edges[i].draw()
		}
	}*/
	
	this.update    = function(graph){
		// Update various properties
		this.degree = this.edges.length
	}
	
	this.attach    = function(){
		this.visible = true
		vertices.push(this)
	}
	
	this.detach    = function(){
		this.visible = false
		listRemove(vertices, this)
		listRemove(selected, this)
		for(var i in this.edges){
			this.edges[i].detach()
		}
	}
	
	this.toJSON    = function(){
		return { id: this.id, value: this.value, x: this.x, y: this.y } // No style support yet
	}
	
	this.toTikZ    = function(){
		return "\\draw (" + this.x + "," + this.y + ") node(v" + this.id + ") {};"
	}
	
	this.isNeighbour = function(v){
		var e
		for(var i in this.edges){
			e = this.edges[i]
			if(
				(e.from === this && e.to   === v) ||
				(e.to   === this && e.from === v)
			){
				return true
			}
		}
		return false
	}
	
	this.neighbours = function(){
		var n = [], e
		for(var i in this.edges){
			e = this.edges[i]
			if(e.from === this){
				n.push(e.to)
			} else if(e.to === this){
				n.push(e.from)
			}
		}
		return n
	}
	
	this.attach()
}

function Edge(id, value, from, to, directed){
	if(typeof id != n){ return false }
	if(typeof value != n && typeof value != s){ value = "" }
	if(typeof from != o || typeof to != o){ return false }
	if(typeof directed != b){ directed = false }
	
	this.id       = id
	this.value    = value
	this.from     = from
	this.to       = to
	this.visible  = true
	this.style    = defaultStyle
	this.directed = directed
	
	this.draw    = function(cx, total, i){
		this._draw(cx, this.style, true, total, i)
	}
	
	this.drawSel = function(cx, total, i){
		this._draw(cx, selectedStyle, false, total, i)
	}
	
	this._draw   = function(cx, style, label, total, i){
		if(this.visible){
			if(typeof total == u || total <= 0){ total = 1 }
			if(typeof i     == u || i     <  0){ i     = 0 }
			
			// Edge curvature
			var space = 50
			var span  = (total-1) * space
			var t     = -span/2 + i*space

			dlog(["Drawing", total, i, t])
			
			// Draw!
			// Edge goes from a to b
			if(this.from.x < this.to.x) {
				var ax = this.from.x
				var ay = this.from.y
				var bx = this.to.x
				var by = this.to.y
			} else {
				var ax = this.to.x
				var ay = this.to.y
				var bx = this.from.x
				var by = this.from.y
			}
			
			styleContext(cx, style, false)
			cx.beginPath()
			cx.moveTo(ax, ay)
			
			if(t == 0){
				// Straight edge
				cx.lineTo(bx, by)
			} else {
				// Curved edge, part of multiedge
				// Curve from a to b, over alpha.
				// m is the midpoint of ab
				var mx = ax + 0.5 * (bx - ax)
				var my = ay + 0.5 * (by - ay)

				// Length of am, since we need to normalize it
				var l = Math.sqrt((ay-by)*(ay-by) + (bx-ax)*(bx-ax))

				// Find the center point of the quadrature
				var alphax = mx + t * (-my+ay)/l
				var alphay = my + t * (mx-ax)/l

				cx.quadraticCurveTo(alphax, alphay, bx, by)
			}
			
			cx.stroke()
			
			//TODO: Draw arrowhead
		}
	}
	
	this.update  = function(graph){
		
	}
	
	this.attach  = function(){
		this.visible = true
		edges.push(this)
		this.from.edges.push(this)
		this.to.edges.push(this)
		this.from.degree++
		this.to.degree++
	}
	
	this.detach  = function(){
		this.visible = false
		listRemove(edges,           this)
		listRemove(selected,        this)
		listRemove(this.from.edges, this)
		listRemove(this.to.edges,   this)
		this.from.degree--
		this.to.degree--
	}
	
	this.toJSON  = function(){
		return { id: this.id, value: this.value, from: this.from.id, to: this.to.id, directed: this.directed } // No style support yet
	}
	
	this.toTikZ  = function(){
		var n = ""
		if(this.value !== ""){
			n = " node {" + this.value + "}"
		}
		return "\\path[draw] (v" + this.from.id + ") -" + (this.directed ? ">" : "-") + n + " (v" + this.to.id + ");"
	}
	
	this.attach()
}


// Graph manipulation methods -----------------------------------------------------------------------------------------------

function graphFromJSON(json){
	if(typeof json != s){ return null }
	try {
		var o = JSON.parse(json)
	} catch(e){
		return null
	}
	var vertices = [], edges = [], j, v, from, to
	for(var i in o.vertices){
		j = o.vertices[i]
		vertices.push(new Vertex(j.id, j.value, j.x, j.y))
		// { id: this.id, value: this.value, x: this.x, y: this.y }
	}
	for(var i in o.edges){
		j = o.edges[i]
		for(var i in vertices){
			v = vertices[i]
			if(v.id == j.from){
				from = v
			}
			if(v.id == j.to){
				to   = v
			}
		}
		edges.push(new Edge(j.id, j.value, from, to, j.directed))
		// { id: this.id, value: this.value, from: this.from.id, to: this.to.id }
	}
	var g = new Graph(vertices, edges)
	g.x   = o.x
	g.y   = o.y
	return g
}

// Interface methods --------------------------------------------------------------------------------------------------------

function getElement(x, y){
	var el, r
	// Check if there's an element on the given coordinates; traverse in reverse order so we get the newest first
	// Vertices
	for(var i = vertices.length - 1; i >= 0; i--){
		el = vertices[i]
		r  = el.style.vertexradius * (touch ? 3 : 1.5)
		//w  = el.style.strokewidth
		if(
			x >= el.x - r && x <= el.x + r &&
			y >= el.y - r && y <= el.y + r
		){
			return el // This is the one!
		}
	}
	
	// Edges
	// New approach because of bezier curves
	// Toletance tol (max distance from check point to mouse)
	var tol = 5
	var edgegroups = graphs[0].edgeGroups()
	// We find points on e with distance h (in pixels)
	var h = 10
	
	for(var s in edgegroups){
		//alert("Here")
		g = edgegroups[s]
		for(var i in g){
		        // Now we have edge e
		        var e = g[i]
		        // There is "total" edges in this group
		        var total = g.length
		        // This is number "i" of them
		        // Edge curvature
			var space = 50
			var span  = (total-1) * space
			var bend  = -span/2 + i*space

			// Curved edge, part of multiedge
			// Curve from a to b, with control point alpha.
			// m is the midpoint of ab
		        if(e.from.x < e.to.x) {
				var ax = e.from.x
				var ay = e.from.y
				var bx = e.to.x
				var by = e.to.y
			} else {
				var ax = e.to.x
				var ay = e.to.y
				var bx = e.from.x
				var by = e.from.y
			}
			var mx = ax + 0.5 * (bx - ax)
			var my = ay + 0.5 * (by - ay)
			
			// Length of am, since we need to normalize it
			var l = Math.sqrt((ay-by)*(ay-by) + (bx-ax)*(bx-ax))

			// Find the center point of the quadrature
			var alphax = mx + bend * (-my+ay)/l
			var alphay = my + bend * (mx-ax)/l
			
			// Now we have the following function of the quadratic curve Q(t)
			// Q(t) = (1-t)^2 a + 2(1-t)t alpha + t^2 b, where t = 0..1
			// Compute each of the d points
			var n = l*2 // length of ab

			// Take n/h steps of length h
			for (var j = 0; j < n; j += h) {
				// Find the corresponding value for t
				var t = j/n
				
				// Compute coordinates of Q(t) = [Qx,Qy]
				var Qx = (1-t)*(1-t) * ax + 2*(1-t)*t * alphax + t*t * bx
				var Qy = (1-t)*(1-t) * ay + 2*(1-t)*t * alphay + t*t * by
				
				distToMouse = Math.sqrt((Qy-y)*(Qy-y) + (Qx-x)*(Qx-x))

				if (distToMouse < tol) {
					return e
				}
			}
		}
	}
	
	return null // None found
}

function evtPosition(evt, ce){
	var o = ce.offset()
	var x = (iu(evt.layerX) ? (iu(evt.offsetX) ? evt.x : evt.offsetX) : evt.layerX) - o.left
	var y = (iu(evt.layerY) ? (iu(evt.offsetY) ? evt.y : evt.offsetY) : evt.layerY) - o.top
	return [x,y]
}

function drawAll(cx){
	if(!cx){ cx = window.cx }
	dlog("DRAWING ALL")
	var el
	cx.clearRect(0, 0, w, h)
	for(var i = 0; i < graphs.length; i++){
		graphs[i].draw(cx)
	}
	// Selected item
	if(selected.length > 0){
		for(var n in selected){
			el = selected[n]
			if(el instanceof Vertex || el instanceof Edge){
				el.drawSel(cx)
			}
		}
	}
}

function setSelected(el, evt, cx){
	var shift = (typeof evt != u && evt != null && "shiftKey" in evt && evt.shiftKey)
	if(selected.length <= 0 || (selected.length > 0 && el != selected[0])){
		if(selected.length > 0 && shift){
			$("#info").html('<div class="selection"><strong>Multiselection</strong></div>')
		} else {
			displayInfo($("#info"), el, cx)
		}
	}
	if(shift){
		selected.push(el)
	} else {
		selected = [el]
	}
}

function canvasMove(evt){
	var p = evtPosition(evt, ce), el
	var x = p[0]
	var y = p[1]
	
	if(dragging && uimode == 0){
		// Set dragging position
		if(dp[0] == null){
			dp = [x,y]
			// Simulated hovering on touch devices
			if(touch){
				hovered = getElement(x,y)
			}
		}
		// We're trying to drag an element
		if(hovered != null){
			// Set selection
			if(!inArray(hovered, selected)){
				setSelected(hovered, evt, cx)
				dp = [x,y]
			}
			// Drag each selected element
			for(var n in selected){
				el = selected[n]
				if(el instanceof Vertex){
					// Set original vertex position
					if(dp[0] == x && dp[1] == y){
						el.ox = el.x
						el.oy = el.y
					}

					// New coordinates
					el.x = el.ox + (x - dp[0])
					el.y = el.oy + (y - dp[1])
				}
			}
			drawAll(cx)
			displayInfo($("#info"), selected, cx) // I give up
			//evt.stopPropagation()
		}
	} else {
		hovered = getElement(x,y)
		if(uimode == 1){
			if(touch && hovered instanceof Vertex){
				dp[(dp[0] == null) ? 0 : 1] = hovered
				selected = [hovered]
				canvasFinishAddEdge(cx)
			}
		} else {
			dp = [null,null]
		}
	}
}

function canvasClick(evt){
	if(!dragging){
		//dlog(evt)
		var p    = evtPosition(evt, ce)
		var x    = p[0]
		var y    = p[1]
		var el   = getElement(x,y)
		if(uimode == 0){
			setSelected(el, evt, cx)
		}
		if(uimode == 0 && evt.altKey && evt.shiftKey && el instanceof Vertex){
			canvasStartAddEdge(cx)
		}
		if(uimode == 1 && el instanceof Vertex){
			dp[(dp[0] == null) ? 0 : 1] = el
			selected = [el]
			canvasFinishAddEdge(cx)
		}
		if((uimode == 2 || (uimode == 0 && evt.altKey && !evt.shiftKey)) && el == null){
			canvasFinishAddVertex(x, y, cx)
		}
		drawAll(cx)
	}
}

function touchMove(evt){
	if(evt.touches.length == 1 && evt.touches[0].target == canvas){
		evt.preventDefault()
		moved  = true
		var ct = evt.changedTouches
		canvasMove({
			layerX: ct[0].pageX,
			layerY: ct[0].pageY
		})
	}
}

function touchEnd(evt){
	//evt.preventDefault()
	dragging = false
	dp       = [null,null]
	var ct   = evt.changedTouches
	if(!moved && ct.length == 1 && ct[0].target == canvas){
		canvasClick({
			layerX: ct[0].pageX,
			layerY: ct[0].pageY
		})
	}
	moved    = false
}

function touchStart(evt) {
	if(evt.touches.length == 1 && evt.touches[0].target == canvas){
		evt.preventDefault()
		dragging = true
		moved    = false
		var ct   = evt.changedTouches
		for(var i = 0; i < ct.length; i++){
			var touch = ct[i]
			canvasMove({
				layerX: touch.pageX,
				layerY: touch.pageY
			})
			return
		}
	}
}

function clearCanvas(cx, bypass){
	if(bypass || confirm("Are you sure you want to clear the canvas? This cannot be undoed.")){
		edges    = []
		vertices = []
		graphs   = []; new Graph()
		selected = [null]
		drawAll(cx)
		displayInfo($("#info"), null, cx)
	}
}

function canvasStartAddEdge(cx){
	var panel = $("#info")
	var m     = $('<div class="message">' + ucf(click) + ' two vertices to add an edge between them. <a href="javascript://">Cancel</a></div>')
	$("a", m).click(function(){ uimode = 0; dp = [null,null]; displayInfo(panel, null, cx) })
	panel.empty().append(m)
	dp     = [null,null]
	uimode = 1
}

function canvasFinishAddEdge(cx){
	if(uimode == 1 && dp[0] instanceof Vertex && dp[1] instanceof Vertex){
		graphs[gi].addEdge(dp, cx)
		uimode   = 0
		dp       = [null,null]
		selected = [null]
		drawAll(cx)
		displayInfo($("#info"), null, cx)
	}
}

function canvasStartAddVertex(cx){
	var panel = $("#info")
	var m     = $('<div class="message">' + ucf(click) + ' anywhere on the canvas to place a vertex. <a href="javascript://">Cancel</a></div>')
	$("a", m).click(function(){ uimode = 0; displayInfo(panel, null, cx) })
	panel.empty().append(m)
	uimode = 2
}

function canvasFinishAddVertex(x, y, cx){
	if(x >= 0 && y >= 0){
		graphs[gi].addVertex([x,y], cx)
		uimode   = 0
		selected = [null]
		drawAll(cx)
		displayInfo($("#info"), null, cx)
	}
}

function removeElement(el, graph, cx){
	var t
	if(el instanceof Vertex) { t = "vertex" }
	else if(el instanceof Edge){ t = "edge" }
	else { return false }
	var r = confirm("Are you sure you want to remove this " + t + "?")
	if(r){
		graph.detachChild(el)
		drawAll(cx)
		displayInfo($("#info"), null, cx)
	}
	return r
}

// Information display methods ---------------------------------------------------------------------------------------------

function displayInfo(panel, el, cx){
	if(el instanceof Array){
		if(el.length > 1){
			panel.html('<div class="selection"><strong>Multiselection</strong></div>')
			return
		} else {
			el = el[0]
		}
	}
	var graph = graphs[gi]
	if(el != null){
		if(el instanceof Vertex){
			var info = $(
				'<div><a class="r button removebtn" href="javascript://">Remove vertex</a>' +
				'<div class="selection"><strong>Vertex</strong></div>' +
				'<div class="col"><p class="field"><label for="label">Label: </label><input type="text" id="label" size="3" value="' + he(el.value) + '" autocapitalize="off"></p>' +
				'<p class="field"><span class="i">Degree: </span>' + he(el.degree) + '</p></div>' +
				'<div class="col"><p class="field"><label for="vx">X: </label><input type="text" id="vx" size="3" value="' + Math.round(el.x) + '"></p>' + 
				'<p class="field"><label for="vy">Y: </label><input type="text" id="vy" size="3" value="' + Math.round(el.y) + '"></p></div></div>'
			)
			$("input#label", info).keyup(function(){ el.value = this.value; drawAll(cx) })
			$("input#vx",    info).keydown(function(evt){ var val = inputNumberKeyUp(this, evt); if(!isNaN(val)){ el.x = val; drawAll(cx) } })
			$("input#vy",    info).keydown(function(evt){ var val = inputNumberKeyUp(this, evt); if(!isNaN(val)){ el.y = val; drawAll(cx) } })
			$("a.removebtn", info).click(function(){ removeElement(el, graph, cx) })
		}
		if(el instanceof Edge){
			var info = $(
				'<div><a class="r button removebtn" href="javascript://">Remove edge</a>' +
				'<div class="selection"><strong>Edge</strong></div>' +
				'<div class="col"><p class="field"><label for="label">Label: </label><input type="text" id="label" size="3" value="' + he(el.value) + '" autocapitalize="off"></p>' +
				'</div>'
			)
			$("input#label", info).keyup(function(){ el.value = this.value; drawAll(cx) })
			$("a.removebtn", info).click(function(){ removeElement(el, graph, cx) })
		}
	} else {
		var seq  = displaySequence(graph.degreeSeq())
		var info = $(
			'<div class="selection"><strong>Graph</strong></div>' +
			'<p class="field"><span class="i">Vertices: </span>' + graph.vertices.length + '</p>' +
			'<p class="field"><span class="i">Edges: </span>' + graph.edges.length + '</p>' +
			'<p class="field"><span class="i" title="Degree sequence">Deg. seq.: </span>' + (seq ? seq : '&nbsp;') + '</p>' +
			'<p class="field"><span class="i" title="Number of spanning trees in this graph">Sp. trees: </span>' + graph.spanningTreeCount() + '</p>'
		)
	}
	panel.empty().append(info)
}

function displaySequence(seq){
	var u = seq.join(", "), s = seq.sort().join(", ")
	return u == s ? he(u) : '<span class="sequence"><span class="unsorted">' + he(u) + '</span>' +
	       '<span class="sorted"> ' + he(s) + '</span></span>'
}

function inputNumberKeyUp(el, evt){
	var val = parseInt(el.value)
	if(!isNaN(val)){
		var code = evt.keyCode || evt.which, up = 38, down = 40
		if(code == up || code == down){ // Increase or decrease
			if(code == up){ val++ }
			else          { val-- }
			el.value = val
		}
	}
	return val
}

// Our example -------------------------------------------------------------------------------------------------------------

// Lucy in the sky with the diamond

var dvertices = [ // [ 1, 2, 3, 4 ]
	//    id, value, x,   y
	new Vertex(1, 1, 100, 150),
	new Vertex(2, 2, 200, 100),
	new Vertex(3, 3, 200, 200),
	new Vertex(4, 4, 300, 150)
]

var dedges = [ // [ [1, 2], [2, 4], [1, 3], [3, 4], [2, 3] ]
	//  id, value, from,         to
	new Edge(1, 0, dvertices[0], dvertices[1]),
	new Edge(2, 0, dvertices[1], dvertices[3]),
	new Edge(3, 0, dvertices[0], dvertices[2]),
	new Edge(4, 0, dvertices[2], dvertices[3]),
	new Edge(5, 0, dvertices[1], dvertices[2])
]

// Initialising the document ------------------------------------------------------------------------------------------------

$(document).ready(function(){
	
	// Variables (I really need to move these out of global scope...)
	ce     = $("canvas")
	canvas = ce.get(0)
	cx     = canvas.getContext("2d")
	var scale     = 1
	
	// Canvas settings
	cx.scale(scale, scale)
	cx.font         = "sans-serif"
	cx.textAlign    = "center"
	cx.textBaseline = "middle"
	
	// Example
	window.diamond = new Graph(dvertices, dedges)
	diamond.draw(cx)
	
	// Mouse
	ce.mousedown     (function(){ dragging = true  })
	$("body").mouseup(function(){ dragging = false })
	ce.mousemove(canvasMove)
	ce.click(canvasClick)
	
	// Touch
	document.body.addEventListener("touchstart",     touchStart, false)
	document.body.addEventListener("gesturechanged", noevt, false)
	document.body.addEventListener("touchend",       touchEnd, false)
	document.body.addEventListener("touchmove",      touchMove, false)
	
	// Buttons
	$("#btnaddvertex").click(function(){ canvasStartAddVertex(cx) })
	$("#btnaddedge").click(function(){ canvasStartAddEdge(cx) })
	$("#btninfo").click(function(){ $("#info").toggle() })
	$("#btnload").click(function(){ var j = prompt("Paste here a graph saved as a string by this app:"); if(j != null && j.length > 0){ clearCanvas(cx, true); graphs = []; graphFromJSON(j); drawAll(cx) } })
	$("#btnsave").click(function(){ prompt("Store the following string somewhere and paste it back here when you want to load this graph again.", JSON.stringify(graphs[gi].toJSON())) })
	$("#btnclear").click(function(){ clearCanvas(cx) })
	
	// Panels
	displayInfo($("#info"), null, cx)
})

// JSON runtime, if you do not already have it
if(!("JSON" in window)){eval(function(p,a,c,k,e,d){e=function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--){d[e(c)]=k[c]||e(c)}k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c])}}return p}('3(!o.p){p={}}(5(){5 f(n){7 n<10?\'0\'+n:n}3(6 1b.z.q!==\'5\'){1b.z.q=5(h){7 o.1C()+\'-\'+f(o.1T()+1)+\'-\'+f(o.1O())+\'T\'+f(o.1D())+\':\'+f(o.1M())+\':\'+f(o.1Q())+\'Z\'};X.z.q=1K.z.q=1I.z.q=5(h){7 o.1V()}}y L=/[\\1W\\13\\1o-\\1l\\1m\\1i\\1n\\1s-\\1p\\1j-\\15\\17-\\14\\18\\1f-\\19]/g,M=/[\\\\\\"\\1B-\\1z\\1w-\\1y\\13\\1o-\\1l\\1m\\1i\\1n\\1s-\\1p\\1j-\\15\\17-\\14\\18\\1f-\\19]/g,8,H,1e={\'\\b\':\'\\\\b\',\'\\t\':\'\\\\t\',\'\\n\':\'\\\\n\',\'\\f\':\'\\\\f\',\'\\r\':\'\\\\r\',\'"\':\'\\\\"\',\'\\\\\':\'\\\\\\\\\'},l;5 N(m){M.1h=0;7 M.11(m)?\'"\'+m.C(M,5(a){y c=1e[a];7 6 c===\'m\'?c:\'\\\\u\'+(\'1k\'+a.1r(0).12(16)).1g(-4)})+\'"\':\'"\'+m+\'"\'}5 E(h,w){y i,k,v,e,K=8,9,2=w[h];3(2&&6 2===\'x\'&&6 2.q===\'5\'){2=2.q(h)}3(6 l===\'5\'){2=l.P(w,h,2)}1u(6 2){J\'m\':7 N(2);J\'S\':7 1v(2)?X(2):\'D\';J\'1x\':J\'D\':7 X(2);J\'x\':3(!2){7\'D\'}8+=H;9=[];3(Q.z.12.1S(2)===\'[x 1R]\'){e=2.e;G(i=0;i<e;i+=1){9[i]=E(i,2)||\'D\'}v=9.e===0?\'[]\':8?\'[\\n\'+8+9.O(\',\\n\'+8)+\'\\n\'+K+\']\':\'[\'+9.O(\',\')+\']\';8=K;7 v}3(l&&6 l===\'x\'){e=l.e;G(i=0;i<e;i+=1){k=l[i];3(6 k===\'m\'){v=E(k,2);3(v){9.1c(N(k)+(8?\': \':\':\')+v)}}}}R{G(k 1t 2){3(Q.1q.P(2,k)){v=E(k,2);3(v){9.1c(N(k)+(8?\': \':\':\')+v)}}}}v=9.e===0?\'{}\':8?\'{\\n\'+8+9.O(\',\\n\'+8)+\'\\n\'+K+\'}\':\'{\'+9.O(\',\')+\'}\';8=K;7 v}}3(6 p.W!==\'5\'){p.W=5(2,A,I){y i;8=\'\';H=\'\';3(6 I===\'S\'){G(i=0;i<I;i+=1){H+=\' \'}}R 3(6 I===\'m\'){H=I}l=A;3(A&&6 A!==\'5\'&&(6 A!==\'x\'||6 A.e!==\'S\')){1a 1d 1E(\'p.W\')}7 E(\'\',{\'\':2})}}3(6 p.Y!==\'5\'){p.Y=5(B,U){y j;5 V(w,h){y k,v,2=w[h];3(2&&6 2===\'x\'){G(k 1t 2){3(Q.1q.P(2,k)){v=V(2,k);3(v!==1L){2[k]=v}R{1J 2[k]}}}}7 U.P(w,h,2)}L.1h=0;3(L.11(B)){B=B.C(L,5(a){7\'\\\\u\'+(\'1k\'+a.1r(0).12(16)).1g(-4)})}3(/^[\\],:{}\\s]*$/.11(B.C(/\\\\(?:["\\\\\\/1G]|u[0-1X-1U-F]{4})/g,\'@\').C(/"[^"\\\\\\n\\r]*"|1A|1P|D|-?\\d+(?:\\.\\d*)?(?:[1N][+\\-]?\\d+)?/g,\']\').C(/(?:^|:|,)(?:\\s*\\[)+/g,\'\'))){j=1F(\'(\'+B+\')\');7 6 U===\'5\'?V({\'\':j},\'\'):j}1a 1d 1H(\'p.Y\')}}}());',62,122,'||value|if||function|typeof|return|gap|partial|||||length|||key||||rep|string||this|JSON|toJSON||||||holder|object|var|prototype|replacer|text|replace|null|str||for|indent|space|case|mind|cx|escapable|quote|join|call|Object|else|number||reviver|walk|stringify|String|parse|||test|toString|u00ad|u206f|u202f||u2060|ufeff|uffff|throw|Date|push|new|meta|ufff0|slice|lastIndex|u17b4|u2028|0000|u0604|u070f|u17b5|u0600|u200f|hasOwnProperty|charCodeAt|u200c|in|switch|isFinite|x7f|boolean|x9f|x1f|true|x00|getUTCFullYear|getUTCHours|Error|eval|bfnrt|SyntaxError|Boolean|delete|Number|undefined|getUTCMinutes|eE|getUTCDate|false|getUTCSeconds|Array|apply|getUTCMonth|fA|valueOf|u0000|9a'.split('|'),0,{}))}

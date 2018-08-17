(function( $ ) {

    $.ec = {
        reals: {},
        modk: {}
    };

    var colors = {
        red: "#cb4b4b",
        yellow: "#edc240",
        blue: "#afd8f8"
    };

    /* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cbrt#Polyfill */
    Math.cbrt = Math.cbrt || function(x) {
        var y = Math.pow(Math.abs(x), 1 / 3);
        return x < 0 ? -y : y;
    };

    var sortUnique = function( arr ) {
        // Sorts an array of numbers and removes duplicate elements in place.

        arr.sort(function( a, b ) {
            return a - b;
        });

        for( var i = 1; i < arr.length; i += 1 ) {
            if( arr[ i ] === arr[ i - 1 ] ) {
                arr.splice( i, 1 );
                i -= 1;
            }
        }
        return arr;
    };

    var round10 = function( value, exp ) {
        // This code has been copied and adapted from the MDN:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round.

        if( typeof exp === "undefined" ) {
            exp = -5;
        }

        // If the exp is undefined or zero...
        if ( +exp === 0 ) {
            return Math.round( value );
        }

        value = +value;
        exp = +exp;

        // If the value is not a number or the exp is not an integer...
        if ( isNaN( value ) || typeof exp !== "number" || exp % 1 !== 0 ) {
          return NaN;
        }

        // Left shift.
        value = value.toString().split( "e" );
        value = Math.round( +( value[ 0 ] + "e" +
                            ( value[ 1 ] ? ( +value[ 1 ] - exp ) : -exp ) ) );

        // Shift back.
        value = value.toString().split( "e" );
        return +( value[0] + "e" +
                  ( value[ 1 ] ? ( +value[ 1 ] + exp ) : exp ) );
    };

    var setInputValuesFromHash = function() {
        var hash = window.location.search;

        if( hash[ 0 ] === "?" ) {
            hash = hash.substr( 1 );
        }

        var items = hash.split( "&" );

        for( var i = 0; i < items.length; i += 1 ) {
            var item = items[ i ].split( "=" );
            var name = item[ 0 ];
            var value = item[ 1 ];

            if( item.length !== 2 ||
                !name ||
                !value ||
                /[^a-z]/.test( name ) ||
                /[^-.0-9]/.test( value ) ) {
                continue;
            }

            $( "input[name='" + name + "']" ).val( value );
        }
    };

    var isPrime = function( n ) {
        n = +n;

        if( n < 2 || n % 2 === 0 ) {
            return n === 2;
        }

        for( var m = 3; m < n; m += 2 ) {
            if( n % m === 0 ) {
                return false;
            }
        }

        return true;
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.Base

    $.ec.Base = function() {
        setInputValuesFromHash();

        this.aInput = $( "input[name='a']" );
        this.bInput = $( "input[name='b']" );
        this.plotContainer = $( "#plot" );
        this.equationContainer = $( ".curve-equation" );
        this.singularWarning = $( ".curve-singular-warning" );

        this.marginFactor = 1 / 8;

        this.plot = $.plot( this.plotContainer, {} );

        var curve = this;
        $().add( this.aInput )
           .add( this.bInput )
           .change(function() { curve.update(); });

        $(function() { curve.update(); });
    };

    $.ec.Base.prototype.modulus = function( p ) {
        throw new Error( "must override" );
    };

    $.ec.Base.prototype.inverseOf = function( p ) {
        throw new Error( "must override" );
    };

    $.ec.Base.prototype.negPoint = function( [ x, y ] ) {
        return [ x, this.modulus( -y ) ];
    };

    $.ec.Base.prototype.getRoots = function( a, b ) {
        // Returns an array containing the coordinates of the points where the
        // curve intersects the x-axis. This means solving the equation:
        //
        //     x^3 + ax + b = 0
        //
        // This function uses a simplified variant of the method for cubic
        // functions:
        // http://en.wikipedia.org/wiki/Cubic_function#Roots_of_a_cubic_function

        if( typeof a === "undefined" ) {
            a = this.a;
        }
        if( typeof b === "undefined" ) {
            b = this.b;
        }

        var roots;
        var q = a / 3;
        var r = -b / 2;
        var delta = q * q * q + r * r;

        if( delta > 0 ) {
            var s = Math.cbrt( r + Math.sqrt( delta ) );
            var t = Math.cbrt( r - Math.sqrt( delta ) );
            roots = [ s + t ];
        }
        else if( delta < 0 ) {
            var t = 2 * Math.sqrt( -q );
            // var s = Math.acos( r / Math.sqrt( -q * q * q ) ); 
                // =acos( (-b/2)/(t/2)/sqrt(-q*-q) )
            var s = Math.acos( b / ( q * t ) ); // 
            roots = [
                t * Math.cos( s / 3 ),
                t * Math.cos( ( s + 2 * Math.PI ) / 3 ),
                t * Math.cos( ( s + 4 * Math.PI ) / 3 )
            ]
        }
        else {
          roots = [
              2 * Math.cbrt( r ),
              Math.cbrt( -r )
          ]
        }

        return sortUnique( roots );
    };

    $.ec.Base.prototype.getSlope = function( p1, p2 ) {
        // Valid for reals and modk, because of using inverseOf and modulus
        var [ x1, y1 ] = p1;
        var [ x2, y2 ] = p2;
        var m;

        if( x1 !== x2 ) {
            // Two distinct points.
            m = ( y1 - y2 ) * this.inverseOf( x1 - x2 );
        }
        else if( y1 === y2 && y1 !== 0) {
            // The points are the same, but the line is not vertical.
            m = ( 3 * x1 * x1 + this.a ) * this.inverseOf( y1 + y1 );
        }
        else {
        // else if( p1 === this.negPoint( p2 ) ) {
            // The points are roots or not the same, and the line is vertical.
            return Infinity;
        }
        // m can be either a negative or a positive number (for example, m = -1
        // and m = 6 are equivalent if we have k = 7). Technically, it does
        // not make any difference. Choose the one with the lowest absolute
        // value, as this number will produce fewer lines, resulting in a nicer
        // plot.
        return this.modulus( m );
    };

    $.ec.Base.prototype.addPoints = function( p1, p2 ) {
        // Returns the result of adding point p1 to point p2, according to the
        // group law for elliptic curves. The point at infinity is represented
        // as null.

        if( p1 === null ) {
            return p2;
        }
        if( p2 === null ) {
            return p1;
        }

        var m = this.getSlope( p1, p2 );
        if ( !isFinite ( m ) ) {
            return null; // Wouldn't be more correct [ Infinity, Infinity ] ?
        }

        var [ x1, y1 ] = p1;
        var [ x2, y2 ] = p2;
        var x3 = m * m - (x1 + x2);     // m*m = x1 + x2 + x3
        var y3 = m * ( x1 - x3 ) - y1;  // m = (y1 + y3)/(x1 - x3)

        return [ this.modulus( x3 ), 
                 this.modulus( y3 ) ];
    };

    $.ec.Base.prototype.mulPoint = function( n, p ) {
        // Returns the result of n * P = P + P + ... (n times).

        if( n === 0 || p === null ) {
            return null;
        }
        if( n < 0 ) {
            n = -n;
            p = this.negPoint( p );
        }

        // Double and add method
        var q = null;
        while( n ) {
            // add if odd
            if( n & 1 ) {
                q = this.addPoints( p, q );
            }
            // double p, half n
            p = this.addPoints( p, p );
            n >>= 1;
        }
        return q;
    };

    // View
    $.ec.Base.prototype.hideGrid = function() {
        var axes = this.plot.getAxes();

        axes.xaxis.options.show = false;
        axes.yaxis.options.show = false;

        var grid = this.plot.getOptions().grid;

        grid.borderWidth = 0;
        grid.margin = { top: 0, left: 0, bottom: 0, right: 0 };
        grid.axisMargin = 0;
        grid.minBorderMargin = 0;
    };

    $.ec.Base.prototype.whiteBackground = function() {
        var grid = this.plot.getOptions().grid;
        grid.backgroundColor = "#ffffff";
    };

    $.ec.Base.prototype.makeLabel = function( name, color ) {
        return $( "<label class='point-label'></label>" )
            .text( name )
            .css({
                "position": "absolute",
                "width": "2em",
                "line-height": "2em",
                "text-align": "center",
                "border-radius": "50%",
                "opacity": "0.8",
                "background-color": color
            })
            .appendTo( this.plotContainer );
    };

    $.ec.Base.prototype.setLabel = function( label, p ) {
        if( p === null ) {
            label.css({ "display": "none" });
        }
        else {
            // Plot X origin is the left
            var xScaled = 
                ( p[ 0 ] - this.plotRange.xMin ) * this.plotContainer.width();
            // Plot Y origin is the top
            var yScaled = 
                ( this.plotRange.yMax - p[ 1 ] ) * this.plotContainer.width();

            label.css({
                "display": "block",
                "left": xScaled / this.plotRange.xRange + 10 + "px",
                "top" : yScaled / this.plotRange.yRange + 10 + "px"
            });
        }
    };

    $.ec.Base.prototype.getPlotRange = function( points ) {
        // Finds a range for the x-axis and the y-axis. This range shows all
        // the given points.

        if( typeof points === "undefined" ) {
            points = [];
        }

        var [ xMin, yMin ] = [  Infinity,  Infinity ];
        var [ xMax, yMax ] = [ -Infinity, -Infinity ];

        for( var p of points ) {
            if( p === null ) {
                continue;
            }
            xMin = Math.min( xMin, p[ 0 ] );
            yMin = Math.min( yMin, p[ 1 ] );
            xMax = Math.max( xMax, p[ 0 ] );
            yMax = Math.max( yMax, p[ 1 ] );
        }

        var xRange = xMax - xMin;
        var yRange = yMax - yMin;

        // Margin 
        if( this.marginFactor ) {
            // Add some margin for better display.
            var xMargin = this.marginFactor * xRange;
            var yMargin = this.marginFactor * yRange;

            // Adjust proportions so that x:y = 1.
            if( yMargin < xMargin ) {
                yMargin = xMargin + ( xRange - yRange ) / 2;
            }
            else {
                xMargin = yMargin + ( yRange - xRange ) / 2;
            }

            if( xMargin === 0 ) {
                // This means that xMax = xMin and yMax = yMin, which is not
                // acceptable.
                xMargin = 5;
                yMargin = 5;
            }
        }
        else {
            var xMargin = 0;
            var yMargin = 0;
        }

        return {
            xMin:   xMin - xMargin, 
            yMin:   yMin - yMargin, 

            xMax:   xMax + xMargin, 
            yMax:   yMax + yMargin, 
            
            xRange: xRange + 2 * xMargin, 
            yRange: yRange + 2 * yMargin
        }
    };

    $.ec.Base.prototype.getPlotData = function() {
        return [];
    };

    // View update
    $.ec.Base.prototype.getInputValues = function() {
        this.a = +this.aInput.val();
        this.b = +this.bInput.val();
    };

    $.ec.Base.prototype.recalculate = function() {
        this.singular   = 
            ( 0 === 4 * this.a * this.a * this.a + 27 * this.b * this.b );
        // Order is important.
        this.roots      = this.getRoots();
        this.plotRange  = this.getPlotRange();
    };

    $.ec.Base.prototype.updateResults = function() {
        var getTerm = function( value, suffix ) {
            if( value > 0 ) {
                return " + " + value + suffix;
            }
            else if( value < 0 ) {
                return " - " + ( -value ) + suffix;
            }
            else {
                return "";
            }
        };

        this.equationContainer.html( "<em>y</em><sup>2</sup> = " +
                                     "<em>x</em><sup>3</sup> " +
                                     getTerm( this.a, "<em>x</em>" ) +
                                     getTerm( this.b, "" ) );

        this.singularWarning.css( "display",
                                  this.singular ? "block" : "none" );
    };

    $.ec.Base.prototype.redraw = function() {
        
        var axes = this.plot.getAxes();
        axes.xaxis.options.min = this.plotRange.xMin;
        axes.xaxis.options.max = this.plotRange.xMax;
        axes.yaxis.options.min = this.plotRange.yMin;
        axes.yaxis.options.max = this.plotRange.yMax;

        this.plot.setData( this.getPlotData() );
        this.plot.setupGrid();
        
        this.plot.draw();
    };

    $.ec.Base.prototype.update = function() {
        this.getInputValues();
        this.recalculate();
        this.updateResults();
        this.redraw();
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.reals.Base

    $.ec.reals.Base = function() {
        $.ec.Base.call( this );
        this.plotResolution = 256;
    };

    $.ec.reals.Base.prototype.constructor = 
        $.ec.reals.Base;

    $.ec.reals.Base.prototype =
        Object.create( $.ec.Base.prototype );
    
    // Model
    $.ec.reals.Base.prototype.modulus = function( m ) {
        return m;
    };

    $.ec.reals.Base.prototype.inverseOf = function( n ) {
        return 1 / n;
    };

    $.ec.reals.Base.prototype.getY = function( x ) {
        // Returns the ordinate >= 0 of the point with the given coordinate.
        // Note that y may be NaN if we are very close
        // to a root (because of floating point roundings).
        var y = Math.sqrt( x * ( x * x + this.a ) + this.b );
        return isNaN( y ) ? 0 : y;
    };

    $.ec.reals.Base.prototype.getX = function( y ) {
        // Returns all the possible coordinates corresponding to the given
        // ordinate.
        return this.getRoots( this.a, this.b - y * y );
    };

    $.ec.reals.Base.prototype.getStationaryPoints = function() {
        // This function returns the list of the x,y coordinates of the
        // stationary points of the curve. It works as follows.
        //
        // If we take the generic equation:
        //
        //     y^2 = x^3 + ax + b
        //
        // We can rewrite it as:
        //
        //     y = +- sqrt( x^3 + ax + b )
        //
        // The first derivative is:
        //
        //     y' = +- ( 3x^2 + a ) / ( 2 * sqrt( x^3 + ax + b ) )
        //
        // Which is zero only if ( 3x^2 + a ) = 0 or, equivalently, a = -3x^2.
        // In order to have a real x satifying the equation, we must have
        // a <= 0. Also, note that (if a <= 0) one solution for x is <= 0, the
        // other is >= 0.
        //
        // Substituting a in the first equation:
        //
        //     y^2 = x^3 + ax + b
        //     y^2 = x^3 - 3x^3 + b
        //     y^2 = b - 2x^3
        //
        // In order to have a real y, we must have b >= 2x^3. Remembering that
        // x0 <= 0 and x1 >= 0, we get that b >= 2 x1^3 implies b >= 2 x0^3. In
        // other words, if we have a stationary point with a positive
        // coordinate, then we must have an another stationary point with a
        // negative coordinate.
        //
        // Therefore...

        var x2 = -this.a / 3    // x2 = x1*x1 = x0*x0
        var x1 = Math.sqrt( x2 );
        var x0 = -x1;
        var y1 = Math.sqrt( this.b - 2 * x1 * x2 );
        var y0 = Math.sqrt( this.b - 2 * x0 * x2 );

        if( isNaN( x0 ) || isNaN( y0 ) ) {
            // If a = -3x^2 > 0, there are no real stationary points.
            // Similarly, if y^2 = b - 2x^3 < 0, there are no real stationary
            // points.
            //
            // Note that if there are no stationary points with a coordinate
            // <= 0, then there are no stationary points at all.
            return [];
        }
        else if( x0 === 0 || isNaN( y1 ) ) {
            // If a = 0 there is just one stationary point at x = 0.
            return [ [ x0, y0 ] ];
        }
        else {
            // In all other cases, we have two distinct stationary points.
            return [ [ x0, y0 ], [ x1, y1 ] ];
        }
    };

    $.ec.reals.Base.prototype.getCurvePoints = function() {
        // Returns a list of x,y points belonging to the curve from xMin to
        // xMax. The resulting array is ordered and may contain some null
        // points in case of discontinuities.

        var points = [];
        var curve = this;

        var getPoints = function( xMin, xMax ) {
            // This function calculates the points of a continuous branch of
            // the curve. The range from xMin to xMax must not contain any
            // discontinuity.
            var x;
            var y;
            var start = points.length; // Not 0 for the case of a third root
            
            // Calculate all points above the x-axis, right-to-left (from xMax
            // to xMin).  plotResolution is defined in $.ec.reals.Base
            var step = curve.plotRange.xRange / curve.plotResolution;
            for( x = xMax; x > xMin; x -= step ) {
                y = curve.getY( x );
                points.push([ x, y ]);
            }

            // Ensure that xMin is calculated. In fact, ( xMax - xMin ) may not
            // be divisible by step.
            y = curve.getY( xMin );
            points.push([ xMin, y ]);

            // Now add the points below the x axis (remembering the simmetry of
            // elliptic curves), this time left-to-right.
            for( var i = points.length - 2; i >= start; i -= 1 ) {
                var p = curve.negPoint( points[ i ] );
                points.push( p );
            }
        };

        if( this.roots.length < 3 ) {
            // We have either one or two roots. In any case, there is only one
            // continuous branch.
            getPoints( this.roots[ 0 ], this.plotRange.xMax );
        }
        else {
            // There are three roots. The curve is composed by: a closed
            // curve...
            getPoints( this.roots[ 0 ], this.roots[ 1 ] );
            points.push( points[ 2 ] );
            points.push( null );
            // ... and an open branch.
            getPoints( this.roots[ 2 ], this.plotRange.xMax );
        }

        return points;
    };

    $.ec.reals.Base.prototype.getLinePoints = function( [ x, y ], q ) {
        var m = this.getSlope( [ x, y ], q );

        if( !isFinite( m ) ) {
            // This is a vertical line and p[ 0 ] === q[ 0 ].
            return [ [ x, this.plotRange.yMin ],
                     [ x, this.plotRange.yMax ] ];
        }

        return [ [ this.plotRange.xMin,
                   y - m * ( x - this.plotRange.xMin ) ],
                 [ this.plotRange.xMax,
                   y  - m * ( x - this.plotRange.xMax ) ] ];
    };

    // View
    $.ec.reals.Base.prototype.fixPointCoordinate = function( xInput, yInput ) {
        // Adjusts the x,y coordinates of a point so that it belongs to the
        // curve.

        var xVal = +xInput.val();
        var yVal = +yInput.val();
        var xPrevVal = +xInput.data( "prev" );
        var yPrevVal = +yInput.data( "prev" );

        if( isNaN( xVal ) || isNaN( yVal ) ) {
            // The user inserted an invalid number.
            return;
        }

        if( [ xVal, yVal ] === [ xPrevVal, yPrevVal ] ) {
            // The coordinates have not changed, however the curve parameters
            // may have changed. We need to check whether the coordinates make
            // sense.
            var validY = round10( this.getY( xVal ) );
            if( yVal < 0 ) {
                validY = -validY;
            }
            if( yVal === validY ) {
                // The coordinates are still perfectly valid. Nothing to do.
                return [ xVal, yVal ];
            }
        }

        if( xVal !== xPrevVal ) {
            if( xVal < this.roots[ 0 ] ) {
                // The x coordinate is invalid and the nearest valid point is
                // the leftmost root.
                xVal = this.roots[ 0 ];
                yVal = 0;
            }
            else if( this.roots.length > 2 &&
                     this.roots[ 1 ] < xVal &&
                     xVal < this.roots[ 2 ] ) {
                // The x coordinate is invalid and there are two roots that can
                // be considered valid. Choose the one that respects the
                // direction of the change.
                xVal = this.roots[ ( xVal > xPrevVal ) ? 2 : 1 ];
                yVal = 0;
            }
            else {
                // The x coordinate is valid. Choose the y coordinate in the
                // most appropriate semiplane.
                if( yVal > 0 ) {
                    yVal = this.getY( xVal );
                }
                else if( yVal < 0 ) {
                    yVal = -this.getY( xVal );
                }
                else if( yVal >= yPrevVal ) { // yVal = 0
                    yVal = this.getY( xVal );
                }
                else { // yVal = 0 && yVal < yPrevVal
                    yVal = -this.getY( xVal );
                }
            }
        }
        else {
            // Either y has changed or the curve parameters have changed.
            // Note that every curve is defined for all y, so we don't
            // have any domain problem here.
            var candidates = this.getX( yVal );
            var distances = candidates.map(function( x ) {
                return Math.abs( x - xPrevVal );
            });
            var lowestDistance = Math.min.apply( null, distances );

            xVal = candidates[ distances.indexOf( lowestDistance ) ];
        }

        // We are forced to round to avoid showing floating point errors that
        // lead to huge inconsistencies.
        xVal = round10( xVal );
        yVal = round10( yVal );

        xInput.val( xVal );
        yInput.val( yVal );

        xInput.data( "prev", xVal );
        yInput.data( "prev", yVal );

        return [ xVal, yVal ];
    };

    $.ec.reals.Base.prototype.getPlotRange = function( points ) {
        // Finds a range for the x-axis and the y-axis. This range must:
        //
        // 1. show all the given points (if any);
        // 2. show the most interesting points of the curve (stationary points
        //    and roots);
        // 3. be proportional: i.e. the x-length and the y-length must be the
        //    same.

        if( typeof points === "undefined" ) {
            points = [];
        }
        else {
            points = points.slice( 0 );
        }
        for( var x of this.roots ) {
            points.push([ x, 0 ]);
        }
        for( var p of this.stationaryPoints ) {
            // stationaryPoints contains only the points above the x axis.
            points.push( p );
            points.push( this.negPoint( p ) );
        }
        if( points.length === 1 ) {
            // There is just one interesting point (the root). If there are no
            // other points, we risk displaying a degenerated plot. The root
            // will be in the left semiplane, we add a point to the right
            // semiplane.
            points.push([ 1, 0 ]);
        }
        return $.ec.Base.prototype.getPlotRange.call( this, points );
    };

    $.ec.reals.Base.prototype.getPlotData = function() {
        var data = $.ec.Base.prototype.getPlotData.call( this );

        data.push({
            color: colors.blue,
            data: this.getCurvePoints(),
            lines: { show: true }
        });
        return data;
    };

    // View update
    $.ec.reals.Base.prototype.recalculate = function() {
        this.stationaryPoints = this.getStationaryPoints();
        $.ec.Base.prototype.recalculate.call( this );
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.reals.PointAddition

    $.ec.reals.PointAddition = function() {
        $.ec.reals.Base.call( this );

        this.pxInput = $( "input[name='px']" );
        this.pyInput = $( "input[name='py']" );
        this.qxInput = $( "input[name='qx']" );
        this.qyInput = $( "input[name='qy']" );
        this.rxInput = $( "input[name='rx']" );
        this.ryInput = $( "input[name='ry']" );

        this.pxInput.data( "prev", this.pxInput.val() );
        this.pyInput.data( "prev", this.pyInput.val() );
        this.qxInput.data( "prev", this.qxInput.val() );
        this.qyInput.data( "prev", this.qyInput.val() );

        this.pLabel = this.makeLabel( "G", colors.yellow );
        this.qLabel = this.makeLabel( "Q", colors.yellow );
        this.rLabel = this.makeLabel( "P", colors.red );

        var curve = this;
        $().add( this.pxInput )
           .add( this.pyInput )
           .add( this.qxInput )
           .add( this.qyInput )
           .change(function() { curve.update(); });
    };

    $.ec.reals.PointAddition.prototype.constructor =
        $.ec.reals.PointAddition;

    $.ec.reals.PointAddition.prototype =
        Object.create( $.ec.reals.Base.prototype );
        
    // View
    $.ec.reals.PointAddition.prototype.getPlotRange = function( points ) {
        if( typeof points === "undefined" ) {
            points = [];
        }
        else {
            points = points.slice( 0 );
        }

        points.push( this.p );
        points.push( this.q );

        if( this.r !== null ) {
            points.push( this.r );
            points.push( this.negPoint( this.r ) );
        }

        return $.ec.reals.Base.prototype.getPlotRange.call( this, points );
    };

    $.ec.reals.PointAddition.prototype.getPlotData = function() {
        var data = $.ec.reals.Base.prototype.getPlotData.call( this );
        var linePoints = this.getLinePoints( this.p, this.q );

        if( this.r !== null ) {
            data.push({
                color: colors.red,
                data: [ this.r,
                        this.negPoint( this.r ) ],
                lines: { show: true }
            });
            data.push({
                color: colors.red,
                data: [ this.r ],
                points: { show: true, radius: 5 },
            });
        }

        data.push({
            color: colors.yellow,
            data: linePoints,
            lines: { show: true }
        });
        data.push({
            color: colors.yellow,
            data: [ this.p, this.q ],
            points: { show: true, radius: 5 }
        });

        return data;
    };

    // View update
    $.ec.reals.PointAddition.prototype.getInputValues = function() {
        $.ec.reals.Base.prototype.getInputValues.call( this );
        this.p = this.fixPointCoordinate( this.pxInput, this.pyInput );
        this.q = this.fixPointCoordinate( this.qxInput, this.qyInput );
    };

    $.ec.reals.PointAddition.prototype.recalculate = function() {
        this.r = this.addPoints( this.p, this.q );
        $.ec.reals.Base.prototype.recalculate.call( this );
    };

    $.ec.reals.PointAddition.prototype.updateResults = function() {
        $.ec.reals.Base.prototype.updateResults.call( this );

        if( this.r !== null ) {
            this.rxInput.val( round10( this.r[ 0 ] ) );
            this.ryInput.val( round10( this.r[ 1 ] ) );
        }
        else {
            this.rxInput.val( "Inf" );
            this.ryInput.val( "Inf" );
        }
    };

    $.ec.reals.PointAddition.prototype.redraw = function() {
        $.ec.reals.Base.prototype.redraw.call( this );
        this.setLabel( this.pLabel, this.p );
        this.setLabel( this.qLabel, this.q );
        this.setLabel( this.rLabel, this.r );
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.reals.ScalarMultiplication

    $.ec.reals.ScalarMultiplication = function() {
        $.ec.reals.Base.call( this );

        this.nInput = $( "input[name='n']" );
        this.pxInput = $( "input[name='px']" );
        this.pyInput = $( "input[name='py']" );
        this.qxInput = $( "input[name='qx']" );
        this.qyInput = $( "input[name='qy']" );

        this.pxInput.data( "prev", this.pxInput.val() );
        this.pyInput.data( "prev", this.pyInput.val() );

        this.pLabel = this.makeLabel( "G", colors.yellow );
        this.qLabel = this.makeLabel( "P", colors.red );

        var curve = this;
        $().add( this.nInput )
           .add( this.pxInput )
           .add( this.pyInput )
           .change(function() { curve.update(); });
    };

    $.ec.reals.ScalarMultiplication.prototype.constructor =
        $.ec.reals.ScalarMultiplication;

    $.ec.reals.ScalarMultiplication.prototype =
        Object.create( $.ec.reals.Base.prototype );
        
    // View
    $.ec.reals.ScalarMultiplication.prototype.getPlotRange = function( points ) {
        if( typeof points === "undefined" ) {
            points = [];
        }
        else {
            points = points.slice( 0 );
        }

        points.push( this.p );

        if( this.q !== null ) {
            points.push( this.q );
        }

        return $.ec.reals.Base.prototype.getPlotRange.call( this, points );
    };

    $.ec.reals.ScalarMultiplication.prototype.getPlotData = function() {
        var data = $.ec.reals.Base.prototype.getPlotData.call( this );

        if( false ) {
            var p = this.p;
            var n = this.n;

            if( n < 0 ) {
                p = this.negPoint( p );
                n = -n;
            }

            var q = p;
            var pattern = [ q ];

            for( var i = 1; i < n; i += 1 ) {
                q = this.addPoints( p, q );
                pattern.push( q );
            }

            data.push({
                color: colors.yellow,
                data: pattern,
                lines: { show: true }
            });
        }

        data.push({
            color: colors.yellow,
            data: [ this.p ],
            points: { show: true, radius: 5 }
        });

        if( this.q !== null ) {
            data.push({
                color: colors.red,
                data: [ this.q ],
                points: { show: true, radius: 5 }
            });
        }

        return data;
    };

    // View update
    $.ec.reals.ScalarMultiplication.prototype.getInputValues = function() {
        $.ec.reals.Base.prototype.getInputValues.call( this );
        this.n = +this.nInput.val();
        this.p = this.fixPointCoordinate( this.pxInput, this.pyInput );
    };

    $.ec.reals.ScalarMultiplication.prototype.recalculate = function() {
        this.q = this.mulPoint( this.n, this.p );
        $.ec.reals.Base.prototype.recalculate.call( this );
    };

    $.ec.reals.ScalarMultiplication.prototype.updateResults = function() {
        $.ec.reals.Base.prototype.updateResults.call( this );

        if( this.q !== null ) {
            this.qxInput.val( round10( this.q[ 0 ] ) );
            this.qyInput.val( round10( this.q[ 1 ] ) );
        }
        else {
            this.qxInput.val( "Inf" );
            this.qyInput.val( "Inf" );
        }
    };

    $.ec.reals.ScalarMultiplication.prototype.redraw = function() {
        $.ec.reals.Base.prototype.redraw.call( this );
        this.setLabel( this.pLabel, this.p );
        this.setLabel( this.qLabel, this.q );
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.modk.Base

    $.ec.modk.Base = function() {
        $.ec.Base.call( this );

        this.marginFactor = 0;
        this.kInput = $( "input[name='p']" );

        this.compositeWarning = $( ".composite-warning" );
        this.fieldOrder = $( ".field-order" );
        this.curveOrder = $( ".curve-order" );

        var curve = this;
        this.kInput.change(function() { curve.update(); });
    };

    $.ec.modk.Base.prototype.constructor = 
        $.ec.modk.Base;

    $.ec.modk.Base.prototype = Object.create(
        $.ec.Base.prototype );
        
    // Model
    $.ec.modk.Base.prototype.modulus = function( m ) {
        // Returns the modular equivalent in the range {modMin, modMax}.
        m %= this.k;
        
         // For positive m:
        while ( m > this.modMax ) {
            m -= this.k;
        };
        // For negative m:
        while ( m < this.modMin ) {
            m += this.k;
        };
        return m;
    };

    $.ec.modk.Base.prototype.inverseOf = function( a ) {
        // Modular inverse, used to get the slope for point addition
        
        // for( let b of this.modValues ) {
        for( let b = this.modMin; b <= this.modMax; b++ ) {
            if( 1 === this.modulus( a * b ) ) {
                return b;
            }
        }
        return Infinity;
    };

    $.ec.modk.Base.prototype.getY = function( x ) {
        // Returns all the possible ordinates corresponding to the given
        // coordinate, usually 2.
        var result = [];
        
        var xSide = this.b + x * (x * x + this.a);
        xSide = this.modulus( xSide );
        
        for( var y of this.modValues ) {
            if( xSide === this.modulus( y * y ) ) {
                result.push( y );
            }
        }
        return result;
    };

    $.ec.modk.Base.prototype.getCurvePoints = function() {
        // Returns a list of x,y points belonging to the curve. 
        // The resulting array is ordered.
        var points = [];

        for( var x of this.modValues ) {
            for( var y of this.getY( x ) ){
                points.push([ x, y ]);
            }
        }
        return points;
    };

    $.ec.modk.Base.prototype.getLinePoints = function( p, q ) {
        var m = this.getSlope( p, q );
        var [ x, y ] = p;

        if( !isFinite( m ) ) {
            // This is a vertical line.
            return [[ x, this.modMin ], 
                    [ x, this.modMax ]];
        }
        if( m === 0 ) {
            // This is a horizontal line and p[ 1 ] === q[ 1 ].
            return [[ this.modMin, y ], 
                    [ this.modMax, y ]];
        }

        // There is a simple way to take into account slopes less than 1, 
        // that is to get the reciproc of the modular inverse of slope.
        // Instead of taking the reciproc, we can just permute x and y,
        // so that the rest of the algorithm remains the same. 
        var inverseSlope = false;
        minv = this.inverseOf( m );
        // minv = 1 / minv;
        if ( Math.abs( minv ) <= Math.abs( m ) ) {
            inverseSlope = true;
            m = minv;
            [ y, x ] = p;
        }

        // Conditional values out of the loop
        if ( m > 0 ) {
            // Slope is positive; 
            var yStart = this.modMin; 
            var yEnd   = this.modMax;
            var dq = this.k;
        }
        else {
            // Slope is negative; 
            var yStart = this.modMax; 
            var yEnd   = this.modMin;
            var dq = -this.k;
        }

        // Find the q corresponding to the "leftmost" line. This is the q that
        // when used in the equation y = m * x + q, and x = modMin, 
        // gives modMin <= y <= modMax.
        var q = y - m * x;
        
        // Origin point of first line
        x = this.modMin;
        y = this.modulus( m * x + q ); // m*(modMin - x) + y
        
        var points = [];
        
        var swapPush = function ( x, y ) {
             // Transposed points for inverse slope
            if( inverseSlope ) {
                return( [ y, x ] );
            } else {
                return( [ x, y ] );
            }
        };
        
        points.push( swapPush( x, y ) );

        q = y - m * x;
        do {
            // End of line
            x = ( yEnd - q ) / m;
            points.push( swapPush( x, yEnd ) );
            
            // Discontinuity between lines
            points.push( null );
            
            // Origin of next line
            points.push( swapPush( x, yStart ) );
            q -= dq;
        } while( x < this.modMax );
        
        // End point of last line
        x = this.modMax;
        y = m * x + q;
        points.push( swapPush( x, y ) );
        return points;
    };

    $.ec.modk.Base.prototype.hasPoint = function( x, y ) {
        // Returns true if the point x,y belongs to the curve.

        for( var candidate of this.getY( x ) ) {
            if ( candidate === y ) {
                return true;
            }
        }
        return false;
    };

    // View
    $.ec.modk.Base.prototype.getPlotRange = function( points ) {
        // Finds a range for the x-axis and the y-axis. This range must:
        //
        // 1. show all the given points (if any);
        // 2. be proportional: i.e. the x-length and the y-length must be the
        //    same.

        if( typeof points === "undefined" ) {
            points = [];
        }
        else {
            points = points.slice( 0 );
        }

        points.push([ this.modMin, this.modMin ]);
        points.push([ this.modMax, this.modMax ]);

        return $.ec.Base.prototype.getPlotRange.call( this, points );
    };

    $.ec.modk.Base.prototype.getPlotData = function() {
        var data = $.ec.Base.prototype.getPlotData.call( this );

        data.push({
            color: colors.blue,
            data: this.curvePoints,
            points: { show: true, radius: 3 }
        });

        return data;
    };

    $.ec.modk.Base.prototype.fixPointCoordinate = function( xInput, yInput ) {
        // Adjusts the x,y coordinates of a point so that it belongs to the
        // curve.

        var xVal = +xInput.val();
        var yVal = +yInput.val();
        var xPrevVal = +xInput.data( "prev" );
        var yPrevVal = +yInput.data( "prev" );

        if( isNaN( xVal ) || isNaN( yVal ) ) {
            // The user inserted an invalid number.
            return [ xPrevVal, yPrevVal ];
        }

        if( this.hasPoint( xVal, yVal ) ) {
            // This point exists -- nothing to do.
            return [ xVal, yVal ];
        }

        // Find a list of candidate points that respect the direction of the
        // change.
        if( xVal > xPrevVal ) {
            var check = function( p ) {
                return p[ 0 ] > xPrevVal;
            }
        }
        else if( xVal < xPrevVal ) {
            var check = function( p ) {
                return p[ 0 ] < xPrevVal;
            }
        }
        else if( yVal > yPrevVal ) {
            var check = function( p ) {
                return p[ 1 ] > yPrevVal;
            }
        }
        else if( yVal < yPrevVal ) {
            var check = function( p ) {
                return p[ 1 ] < yPrevVal;
            }
        }
        else {
            // Neither xVal nor yVal have changed (but probably a, b or k
            // have).
            var check = function( p ) {
                return true;
            }
        }

        var candidates = [];

        for( var p of this.curvePoints ) {
            if( check( p ) ) {
                candidates.push( p );
            }
        }

        if( candidates === [] ) {
            if( this.hasPoint( xPrevVal, yPrevVal ) ) {
                // There are no candidates and the previous point is still
                // valid.
                xInput.val( xPrevVal );
                yInput.val( yPrevVal );
                return [ xPrevVal, yPrevVal ];
            }

            // There are no candidates but the previous point is no longer
            // valid (this may happen if a, b or k have changed).
            candidates = this.curvePoints;

            if( candidates === [] ) {
                // Nothing to do.
                return [ xPrevVal, yPrevVal ];
            }
        }

        var distances = candidates.map(function( p ) {
            var deltaX = xVal - p[ 0 ];
            var deltaY = yVal - p[ 1 ];
            return deltaX * deltaX + deltaY * deltaY;
        });
        var lowestDistance = Math.min.apply( null, distances );

        var p = candidates[ distances.indexOf( lowestDistance ) ];

        xInput.val( p[ 0 ] );
        yInput.val( p[ 1 ] );

        xInput.data( "prev", p[ 0 ] );
        yInput.data( "prev", p[ 1 ] );

        return p;
    };

    // View update
    $.ec.modk.Base.prototype.getInputValues = function() {
        $.ec.Base.prototype.getInputValues.call( this );

        this.k = +this.kInput.val();
        this.prime = isPrime( this.k );

        // Limits for all the modular values. Setting modMin = 0 will make 
        // everything work in the usual way of only positive modular values. 
        var modMin = -Math.floor( this.k / 2 );
        // var modMin = 0;
        var modMax = modMin + this.k - 1;
        this.modMin = modMin;
        this.modMax = modMax;
        
        var modValues = [];
        for( let v = modMin; v <= modMax; v++ ) {
            modValues.push( v );
        }
        this.modValues = modValues;
        
        // This must go here, rather than in recalculate(), because
        // fixPointCoordinates() depends on curvePoints.
        this.curvePoints = this.getCurvePoints();
    };

    $.ec.modk.Base.prototype.updateResults = function() {
        $.ec.Base.prototype.updateResults.call( this );
        this.compositeWarning.css({ "display":
                                    this.prime ? "none" : "block" });
        this.fieldOrder.text( this.k );
        this.curveOrder.text( this.curvePoints.length + 1 );
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.modk.PointAddition

    $.ec.modk.PointAddition = function() {
        $.ec.modk.Base.call( this );

        this.pxInput = $( "input[name='px']" );
        this.pyInput = $( "input[name='py']" );
        this.qxInput = $( "input[name='qx']" );
        this.qyInput = $( "input[name='qy']" );
        this.rxInput = $( "input[name='rx']" );
        this.ryInput = $( "input[name='ry']" );

        this.pxInput.data( "prev", this.pxInput.val() );
        this.pyInput.data( "prev", this.pyInput.val() );
        this.qxInput.data( "prev", this.qxInput.val() );
        this.qyInput.data( "prev", this.qyInput.val() );

        this.pLabel = this.makeLabel( "G", colors.yellow );
        this.qLabel = this.makeLabel( "Q", colors.yellow );
        this.rLabel = this.makeLabel( "P", colors.red );

        var curve = this;
        $().add( this.pxInput )
           .add( this.pyInput )
           .add( this.qxInput )
           .add( this.qyInput )
           .change(function() { curve.update(); });
    };

    $.ec.modk.PointAddition.prototype.constructor =
        $.ec.modk.PointAddition;

    $.ec.modk.PointAddition.prototype =
        Object.create( $.ec.modk.Base.prototype );
        
    // View
    $.ec.modk.PointAddition.prototype.getPlotData = function() {
        var data = $.ec.modk.Base.prototype.getPlotData.call( this );
        var linePoints = this.getLinePoints( this.p, this.q );

        if( this.r !== null ) {
            data.push({
                color: colors.red,
                data: [ this.r,
                        this.negPoint( this.r ) ],
                lines: { show: true }
            });
            data.push({
                color: colors.red,
                data: [ this.r ],
                points: { show: true, radius: 5 },
            });
        }

        data.push({
            color: colors.yellow,
            data: linePoints,
            lines: { show: true }
        });
        data.push({
            color: colors.yellow,
            data: [ this.p, this.q ],
            points: { show: true, radius: 5 }
        });

        return data;
    };

    // View update
    $.ec.modk.PointAddition.prototype.getInputValues = function() {
        $.ec.modk.Base.prototype.getInputValues.call( this );
        this.p = this.fixPointCoordinate( this.pxInput, this.pyInput );
        this.q = this.fixPointCoordinate( this.qxInput, this.qyInput );
    };

    $.ec.modk.PointAddition.prototype.recalculate = function() {
        this.r = this.addPoints( this.p, this.q );
        $.ec.modk.Base.prototype.recalculate.call( this );
    };

    $.ec.modk.PointAddition.prototype.updateResults = function() {
        $.ec.modk.Base.prototype.updateResults.call( this );

        if( this.r !== null ) {
            this.rxInput.val( round10( this.r[ 0 ] ) );
            this.ryInput.val( round10( this.r[ 1 ] ) );
        }
        else {
            this.rxInput.val( "Inf" );
            this.ryInput.val( "Inf" );
        }
    };

    $.ec.modk.PointAddition.prototype.redraw = function() {
        $.ec.modk.Base.prototype.redraw.call( this );
        this.setLabel( this.pLabel, this.p );
        this.setLabel( this.qLabel, this.q );
        this.setLabel( this.rLabel, this.r );
    };


    ///////////////////////////////////////////////////////////////////////////
    // $.ec.modk.ScalarMultiplication

    $.ec.modk.ScalarMultiplication = function() {
        $.ec.modk.Base.call( this );

        this.nInput = $( "input[name='n']" );
        this.pxInput = $( "input[name='px']" );
        this.pyInput = $( "input[name='py']" );
        this.qxInput = $( "input[name='qx']" );
        this.qyInput = $( "input[name='qy']" );

        this.subgroupOrder = $( ".subgroup-order" );

        this.pxInput.data( "prev", this.pxInput.val() );
        this.pyInput.data( "prev", this.pyInput.val() );

        this.pLabel = this.makeLabel( "G", colors.yellow );
        this.qLabel = this.makeLabel( "P", colors.red );

        var curve = this;
        $().add( this.nInput )
           .add( this.pxInput )
           .add( this.pyInput )
           .change(function() { curve.update(); });
    };

    $.ec.modk.ScalarMultiplication.prototype.constructor =
        $.ec.modk.ScalarMultiplication;

    $.ec.modk.ScalarMultiplication.prototype =
        Object.create( $.ec.modk.Base.prototype );
    
    // Model
    $.ec.modk.ScalarMultiplication.prototype.getSubgroupOrder = function() {
        if( this.singular || !this.prime ) {
            return 0;
        }
        var q = this.p;        
        for( n = 1; q !== null; n++ ) {
            q = this.addPoints( q, this.p );
        }
        return n;
    };

    // View
    $.ec.modk.ScalarMultiplication.prototype.getPlotRange = function(
            points ) {
        if( typeof points === "undefined" ) {
            points = [];
        }
        else {
            points = points.slice( 0 );
        }

        points.push( this.p );

        if( this.q !== null ) {
            points.push( this.q );
        }

        return $.ec.modk.Base.prototype.getPlotRange.call( this, points );
    };

    $.ec.modk.ScalarMultiplication.prototype.getPlotData = function() {
        var data = $.ec.modk.Base.prototype.getPlotData.call( this );

        data.push({
            color: colors.yellow,
            data: [ this.p ],
            points: { show: true, radius: 5 }
        });

        if( this.q !== null ) {
            data.push({
                color: colors.red,
                data: [ this.q ],
                points: { show: true, radius: 5 }
            });
        }

        return data;
    };

    // View update
    $.ec.modk.ScalarMultiplication.prototype.getInputValues = function() {
        $.ec.modk.Base.prototype.getInputValues.call( this );
        this.n = +this.nInput.val();
        this.p = this.fixPointCoordinate( this.pxInput, this.pyInput );
    };

    $.ec.modk.ScalarMultiplication.prototype.recalculate = function() {
        this.q = this.mulPoint( this.n, this.p );
        $.ec.modk.Base.prototype.recalculate.call( this );
    };

    $.ec.modk.ScalarMultiplication.prototype.updateResults = function() {
        $.ec.modk.Base.prototype.updateResults.call( this );

        if( this.q !== null ) {
            this.qxInput.val( round10( this.q[ 0 ] ) );
            this.qyInput.val( round10( this.q[ 1 ] ) );
        }
        else {
            this.qxInput.val( "Inf" );
            this.qyInput.val( "Inf" );
        }

        this.subgroupOrder.text( this.getSubgroupOrder() );
    };

    $.ec.modk.ScalarMultiplication.prototype.redraw = function() {
        $.ec.modk.Base.prototype.redraw.call( this );
        this.setLabel( this.pLabel, this.p );
        this.setLabel( this.qLabel, this.q );
    };

}( jQuery ));

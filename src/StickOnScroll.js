import EventEmitter         from "common-micro-libs/src/jsutils/EventEmitter"
import dataStore            from "common-micro-libs/src/jsutils/dataStore"
import objectExtend         from "common-micro-libs/src/jsutils/objectExtend"

import domHasClass          from "common-micro-libs/src/domutils/domHasClass"
import domAddClass          from "common-micro-libs/src/domutils/domAddClass"
import domRemoveClass       from "common-micro-libs/src/domutils/domRemoveClass"
import domAddEventListener  from "common-micro-libs/src/domutils/domAddEventListener"
import domIsVisible         from "common-micro-libs/src/domutils/domIsVisible"
import domTriggerEvent      from "common-micro-libs/src/domutils/domTriggerEvent"
import domOffset            from "common-micro-libs/src/domutils/domOffset"
import domSetStyle          from "common-micro-libs/src/domutils/domSetStyle"
import domPositionedParent  from "common-micro-libs/src/domutils/domPositionedParent"

//==========================================================================
const PRIVATE                       = dataStore.create();
const CSS_CLASS_HAS_STICK_ON_SCROLL = "hasStickOnScroll";
const IS_IE                         = navigator.userAgent.indexOf("Trident") > -1;
const WINDOW                        = window;
const DOCUMENT                      = WINDOW.document;


let viewports                       = {};

/**
 * StickOnScroll will make elements sticks within a viewport (window or scrollable element)
 *
 * @class StickOnScroll
 * @extends EventEmitter
 *
 * @param {Object} options
 */
const StickOnScroll = EventEmitter.extend(/** @lends StickOnScroll.prototype */{
    init(options) {
        var inst = {
            opt: objectExtend({}, this.getFactory().defaults, options)
        };

        PRIVATE.set(this, inst);

        let opt = inst.opt;
        let ele = opt.ele;

        // If element already has stickonscroll, exit.
        if (!ele || domHasClass(ele, CSS_CLASS_HAS_STICK_ON_SCROLL)) {
            return;
        }

        domAddClass(ele, CSS_CLASS_HAS_STICK_ON_SCROLL);

        let setIntTries = 1800; // 1800 tries * 100 milliseconds = 3 minutes
        let viewportKey, setIntID;

        opt.isStick                   = false;
        opt.ele                       = ele;
        opt.eleParent                 = opt.ele.parentNode;
        opt.eleOffsetParent           = domPositionedParent(ele);
        opt.eleTop                    = 0;
        opt.eleTopMargin              = parseFloat((ele.style.marginTop || 0)) || 0;
        opt.isWindow                  = true;
        opt.isOnStickSet              = "function" === typeof opt.onStick;
        opt.isOnUnStickSet            = "function" === opt.onUnStick;
        opt.wasStickCalled            = false;
        opt.isViewportOffsetParent    = true;

        /**
         * Retrieves the element's top position based on the type of viewport
         * and sets on the options object for the instance. This Top position
         * is the element top position relative to the the viewport.
         *
         * @return {Number}
         */
        opt.setEleTop = function(){
            if (opt.isStick === false) {
                if (opt.isWindow) {
                    opt.eleTop = domOffset(opt.ele).top;

                } else {
                    opt.eleTop = domOffset(opt.ele).top - domOffset(opt.viewport).top;
                }
            }
        };

        /**
         * Returns an elements top position in relation
         * to the viewport's Top Position.
         *
         * @param {HTMLElement} $ele
         *          This element must be inside the viewport
         *
         * @return {Number}
         *
         */
        opt.getEleTopPosition = function($ele) {
            var pos = 0;

            if (opt.isWindow) {
                pos = domOffset($ele.offset).top;

            } else {
                pos = domOffset($ele).top - domOffset(opt.viewport).top;
            }

            return pos;
        };

        /**
         * Get's the MAX top position for the element before it
         * is made sticky. In some cases the max could be less
         * than the original position of the element, which means
         * the element would always be sticky... in these instances
         * the max top will be set to the element's top position.
         *
         * @return {Number}
         */
        opt.getEleMaxTop = function() {
            var max = opt.eleTop - opt.topOffset;

            if (!opt.isWindow) {
                max += opt.eleTopMargin;
            }

            return max;
        };

        /**
         * Gets the distance between the top of the element and the
         * top of the viewport. Basically the offset from the top of
         * the "page" inside the viewport. This distance is alwasy the
         * same even if the viewport is scrolled. The only time it
         * changes is when elements are inserted or removed above the
         * the Element or item above it are hidden/displayed.
         * Methods uses the Position() values until it reaches the
         * viewport
         */
        opt.getElementDistanceFromViewport = function($ele) {
            let distance    = domOffset($ele, true).top; // FIXME: Need true offset from parent (was: $ele.position().top)
            let $parent     = domPositionedParent($ele);

            // If the parent element is the root body element, then
            // we've reached the last possible offsetParent(). Exit
            if (isBodyElement($parent) || $parent.tagName.toUpperCase() === "HTML") {
                return distance;
            }

            // If the positioned parent of this element is NOT
            // the viewport, then add the distance of that element's
            // top position
            if ($parent !== opt.viewport[0] ) {
                distance = distance + opt.getElementDistanceFromViewport($parent);

                // ELSE, this is the viewport... Adjust the elements
                // Distance by adding on the amount of scroll the element
                // currently has
            } else {
                distance = distance + opt.viewport.scrollTop;
            }

            return distance;
        };

        // If setParentOnStick is true, and the parent element
        // is the <body>, then set setParentOnStick to false.
        if (opt.setParentOnStick === true && isBodyElement(opt.eleParent)){
            opt.setParentOnStick = false;
        }

        if (
            opt.viewport !== WINDOW &&
            opt.viewport !== DOCUMENT &&
            opt.viewport !== DOCUMENT.body
        ) {
            opt.isWindow  = false;
        }

        opt.viewport = getViewportScrollingElement(opt.viewport);

        /**
         * Adds this sticky element to the list of element for the viewport.
         *
         */
        function addThisEleToViewportList() {
            opt.setEleTop();
            viewportKey = opt.viewport.stickOnScroll;

            // If the viewport is not the Window element, and the view port is not the
            // stick element's imediate offset parent, then we need to adjust the
            // top-offset so that element are position correctly.
            // See issue #3 on github
            if (!opt.isWindow) {
                opt.isViewportOffsetParent    = ( opt.eleOffsetParent === opt.viewport );
            }

            // If this viewport is not yet defined, set it up now (sets up the scroll listener
            if (!viewportKey) {
                viewportKey = "stickOnScroll" + String(Math.random()).replace(/\D/g,"");
                opt.viewport.stickOnScroll = viewportKey;
                viewports[viewportKey] = [];

                let viewportScrollingEle = opt.viewport;

                // When the view port is the WINDOW, then scrolling event listener goes
                // on the document
                if (opt.isWindow){
                    viewportScrollingEle = DOCUMENT;
                }

                domAddEventListener(viewportScrollingEle, "scroll", processElements.bind(opt.viewport)); // FIXME: destory ev listner
            }

            // Push this element's data to this view port's array
            viewports[viewportKey].push(opt);

            // Trigger a scroll even
            processElements.call(opt.viewport);
        }

        // If Element is not visible, then we have to wait until it is
        // in order to set it up. We need to obtain the top position of
        // the element in order to make the right decision when it comes
        // to making the element sticky.
        if (domIsVisible(opt.ele)) {
            addThisEleToViewportList();

        } else {
            setIntID = setInterval(function(){
                if (domIsVisible(opt.ele) || !setIntTries) {
                    clearInterval(setIntID);
                    setIntID = null;
                    addThisEleToViewportList();
                }

                --setIntTries;
            }, 100);
        }

        this.onDestroy(() => {
            if (setIntID) {
                clearInterval(setIntID);
                setIntID = null;
            }

            viewports[viewportKey].some((instOpt, index) => {
                if (instOpt === opt) {
                    viewports[viewportKey][index] = null;
                    return true;
                }
            });

            // Destroy all Compose object
            Object.keys(inst).forEach(function (prop) {
                if (inst[prop]) {
                    [
                        "destroy",      // Compose
                        "remove",       // DOM Events Listeners
                        "off"           // EventEmitter Listeners
                    ].some((method) => {
                        if (inst[prop][method]) {
                            inst[prop][method]();
                            return true;
                        }
                    });

                    inst[prop] = undefined;
                }
            });

            PRIVATE['delete'](this);
        });
    }
});



/**
 * Function bound to viewport's scroll event. Loops through
 * the list of elements that needs to be sticked for the
 * given viewport.
 * "this" keyword is assumed to be the viewport.
 *
 * @param {eventObject} jQuery's event object.
 *
 * @return {Object} The viewport (this keyword)
 *
 */
function processElements(/*ev*/) {
    var elements = viewports[this.stickOnScroll],
        i,j;

    // Loop through all elements bound to this viewport.
    for( i=0,j=elements.length; i<j; i++ ){

        // Scope in the variables
        // We call this anonymous funnction with the
        // current array element ( elements[i] )
        (function(opt){

            var scrollTop,
                maxTop,
                cssPosition,
                footerTop,
                eleHeight,
                yAxis;

            // get this viewport options
            opt = elements[i];

            // FIXME: Should the clean up of reference to removed element store the position in the array and delete it later?

            // If element has no parent, then it must have been removed from DOM...
            // Remove reference to it from the viewport
            if (opt && !DOCUMENT.documentElement.contains(opt.ele)) {
                elements[i] = opt = null;
            }

            if (opt) {
                // Get the scroll top position on the view port
                scrollTop = getViewportScrollingElement(opt.viewport).scrollTop;

                // FIXME: cleanup
                // opt.isWindow ? opt.viewport.DOCUMENT.scrollingElement.scrollTop : opt.viewport.scrollTop;

                // set the maxTop before we stick the element
                // to be it's "normal" topPosition minus offset
                maxTop = opt.getEleMaxTop();

                // TODO: What about calculating top values with margin's set?

                // FIXME: If not using the window object, then stop any IE animation
                //if (opt.isWindow === false && isIE) {
                //    opt.ele.stop();
                //}

                // If the current scrollTop position is greater
                // than our maxTop value, then make element stick on the page.
                if (scrollTop >= maxTop){
                    cssPosition = {
                        position:   "fixed",
                        top:        opt.topOffset - opt.eleTopMargin
                    };

                    if (!opt.isWindow) {
                        cssPosition = {
                            position:   "absolute",
                            top:        (scrollTop + opt.topOffset) - opt.eleTopMargin
                        };
                    }


                    // ---> HAS FOOTER ELEMENT?
                    // check to see if it we're reaching the footer element,
                    // and if so, scroll the item up with the page
                    if  (opt.footerElement) {

                        // Calculate the distance from the *bottom* of the fixed
                        // element to the footer element, taking into consideration
                        // the bottomOffset that may have been set by the user.
                        footerTop   = opt.getEleTopPosition(opt.footerElement);
                        eleHeight   = opt.ele.clientHeight;

                        //yAxis       = cssPosition.top + eleHeight + opt.bottomOffset + opt.topOffset;

                        if (!opt.isWindow) {
                            yAxis = eleHeight + opt.bottomOffset + opt.topOffset;

                        } else {
                            yAxis       = cssPosition.top + scrollTop + eleHeight + opt.bottomOffset;
                            footerTop   = opt.getElementDistanceFromViewport(opt.footerElement);
                        }

                        // If the footer element is overstopping the sticky element
                        // position, then adjust it so that we make room for the
                        // footer element.
                        if (yAxis > footerTop) {
                            if (opt.isWindow) {
                                cssPosition.top = footerTop - (scrollTop + eleHeight + opt.bottomOffset);

                                // Absolute positioned element
                            } else {
                                cssPosition.top = scrollTop - (yAxis - footerTop - opt.topOffset);
                            }
                        }
                    }

                    if (!opt.isStick) {
                        // If o.setParentOnStick is true, then set the
                        // height to this node's parent.
                        if (opt.setParentOnStick === true) {
                            domSetStyle(opt.eleParent, { height: opt.eleParent.clientHeight + "px" });
                        }

                        // If o.setWidthOnStick is true, then set the width on the
                        // element that is about to be Sticky.
                        if (opt.setWidthOnStick === true) {
                            domSetStyle(opt.ele, { width: opt.ele.clientWidth + "px" });

                        }
                    }

                    // If we have additional stick offset, apply it now
                    if (!opt.isViewportOffsetParent) {
                        cssPosition.top = (
                            cssPosition.top - opt.getElementDistanceFromViewport(opt.eleOffsetParent)
                        );
                    }

                    if (cssPosition.top) {
                        cssPosition.top += "px";
                    }

                    // Stick the element
                    if (IS_IE && opt.isWindow === false) {
                        domSetStyle(opt.ele, cssPosition);
                        domAddClass(opt.ele, opt.stickClass);

                        // FIXME: IE - animate showing element....

                        //opt.ele
                        //    .addClass(opt.stickClass)
                        //    .css("position", cssPosition.position)
                        //    .animate({top: cssPosition.top}, 150);

                    } else {
                        domSetStyle(opt.ele, cssPosition);
                        domAddClass(opt.ele, opt.stickClass);
                    }

                    // If making element stick now, then trigger
                    // onStick callback if any
                    if (opt.wasStickCalled === false) {
                        opt.wasStickCalled = true;

                        setTimeout(function(){
                            if (opt.isOnStickSet === true) {
                                opt.onStick.call(opt.ele, opt.ele);
                            }

                            // FIXME: event emitting
                            // opt.ele.trigger("stickOnScroll:onStick", [opt.ele]);

                        }, 20);
                    }

                    opt.isStick = true;

                    // ELSE, If the scrollTop of the view port is
                    // less than the maxTop, then throw the element back into the
                    // page normal flow
                } else if (scrollTop <= maxTop) {

                    if (opt.isStick) {
                        domRemoveClass(opt.ele, opt.stickClass);
                        domSetStyle(opt.ele, {
                            position: "",
                            top: ""
                        });
                        opt.isStick = false;

                        // Reset parent if o.setParentOnStick is true
                        if (opt.setParentOnStick === true) {
                            domSetStyle(opt.eleParent, { height: "" });
                        }

                        // Reset the element's width if o.setWidthOnStick is true
                        if (opt.setWidthOnStick === true) {
                            domSetStyle(opt.ele, { width: "" });
                        }

                        opt.wasStickCalled = false;

                        setTimeout(function(){
                            // Execute the onUnStick if defined
                            if (opt.isOnUnStickSet) {
                                opt.onUnStick.call( opt.ele, opt.ele );
                            }

                            // FIXME: emit events
                            // opt.ele.trigger("stickOnScroll:onUnStick", [opt.ele]);
                        }, 20);
                    }
                }

                // Recalculate the original top position of the element...
                // this could have changed from when element was initialized
                // - ex. elements were inserted into DOM. We re-calculate only
                // if the we're at the very top of the viewport, so that we can
                // get a good position.
                if (scrollTop === 0) {
                    opt.setEleTop();
                }

            }
        })( elements[i] );
    }
}

function getViewportScrollingElement(viewport) {
    if (viewport === WINDOW || viewport === DOCUMENT || isBodyElement(viewport)) {
        if (IS_IE) {
            return DOCUMENT.scrollingElement || DOCUMENT.documentElement || DOCUMENT.body;
        }
        return DOCUMENT.scrollingElement || DOCUMENT.body;
    }
    return viewport;
}

function isBodyElement(ele) {
    let tagName = ele && ele.tagname ? ele.tagName : null;

    return tagName && tagName.toUpperCase() === "BODY";
}


/**
 * Global default options for StickOnScroll
 *
 * @name StickOnScroll.defaults
 * @type {Object}
 */
StickOnScroll.defaults = {
    ele:                null,
    topOffset:          0,
    bottomOffset:       5,
    footerElement:      null,
    viewport:           WINDOW,
    stickClass:         'stickOnScroll-on',
    setParentOnStick:   false,
    setWidthOnStick:    false,
    onStick:            null,
    onUnStick:          null
};

export default StickOnScroll;

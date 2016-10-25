(function (exporter) {
    //Dependencies
    var StackTrace = require("stacktrace-js");
    var tim = require("tinytim");

    /** Function.getUID
     * Allow each function to hold its own UID.
     * Used for global_tags.
     */
    function generateUID() {
        return ((2 - Math.random()).toString() + (2 - Math.random()).toString()).replace(/\./g, "");
    }
    Function.prototype.UID = null;
    Function.prototype.getUID = function () {
        this.UID = this.UID || generateUID();
        return this.UID;
    };

    /** settings
     * An object containing flags to change some behaviour of the logger
     */
    var settings;
    exporter.settings = settings = {
        dateTimeFormat: "[YYYY-MM-DD, HH:mm:SS.sss]", //The format for outputting date/time tags on logged messages
        useDateTime: false, //Show date/time tags on logged messages
        useTags: false, //Show custom tags on logged messages
        useTextTransformations: false, //Apply custom text transformation functions to logged messages
        useObjectTransformations: false, //Apply custom object transformation functions to logged messages
        transformTags: true, //Apply transformation functions to tags as well as logged messages
        disableLogging: false, //Disable logging (use in production code)
        useMicroTemplates: true //Use tinytim to add dynamic information to logs. Most of the information retrieved is using stacktrace-js
    };


    /** Tag functionality
     * Functionality to tag messages coming from a specific scope, or from all scopes
     */
    var global_tags = [];
    var local_tags = {};
    var persistent_tags = {};
    (function () {
        exporter.tags = {};

        /** tags.createLocal
         * Creates a tag to be added to any console log from within 'fn'
         *
         * @param fn - The function in whose scope to apply the tag.
         * @param tag - The tag to apply.
         */
        exporter.tags.createLocal = function (tag, fn) {
            var uid = fn.getUID();

            local_tags[uid] = local_tags[uid] || [];
            local_tags[uid].push(tag);
        };

        /** tags.createGlobal
         * Creates a tag to be added to any console log
         *
         * @param tag - The tag to apply.
         */
        exporter.tags.createGlobal = function (tag) {
            global_tags.push(tag);
        };

        /** tags.createPersistent
         * Creates a tag to be added to any console log from within 'fn', and any subsequent function calls
         * inside 'fn' (recursive)
         *
         * @param fn - The function in whose scope to apply the tag.
         * @param tag - The tag to apply.
         */
        exporter.tags.createPersistent = function (tag, fn) {
            var uid = fn.getUID();

            persistent_tags[uid] = persistent_tags[uid] || [];
            persistent_tags[uid].push(tag);
        };

        /** tags.deleteLocal
         * Removes a local tag associated with a particular function.
         *
         * @param tag
         * @param fn
         */
        exporter.tags.deleteLocal = function (tag, fn) {
            var uid = fn.getUID();

            if (local_tags[uid].indexOf(tag) > -1) {
                local_tags[uid].splice(local_tags[uid].indexOf(tag), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete local tag \"" + tag + "\" from function \"" + fn.name + "\" because it does not exist"}
            }
        };

        /** tags.deleteGlobal
         * Removes a global tag.
         *
         * @param tag
         */
        exporter.tags.deleteGlobal = function (tag) {
            if (global_tags.indexOf(tag) > -1) {
                global_tags.splice(global_tags.indexOf(tag), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete global tag \"" + tag + "\" because it does not exist"}
            }
        };

        /** tags.deletePersistent
         * Removes a persistent tag from a particular function
         *
         * @param tag
         * @param fn
         */
        exporter.tags.deletePersistent = function (tag, fn) {
            var uid = fn.getUID();

            if (persistent_tags[uid].indexOf(tag) > -1) {
                persistent_tags[uid].splice(persistent_tags[uid].indexOf(tag), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete persistent tag \"" + tag + "\" from function \"" + fn.name + "\" because it does not exist"}
            }
        };

        /** tags.clearLocal
         * Removes all local tags associated with a particular function.
         *
         * @param fn
         */
        exporter.tags.clearLocal = function (fn) {
            var uid = fn.getUID();

            if (local_tags[uid]) {
                delete local_tags[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear local tags from function \"" + fn.name + "\" because there are none."}
            }
        };

        /** tags.clearGlobal
         * Removes all global tags.
         */
        exporter.tags.clearGlobal = function () {
            global_tags = [];
        };

        /** tags.clearPersistent
         * Removes all persistent tags from a particular function.
         *
         * @param fn
         */
        exporter.tags.clearPersistent = function (fn) {
            var uid = fn.getUID();

            if (persistent_tags[uid]) {
                delete persistent_tags[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear persistent tags from function \"" + fn.name + "\" because there are none."}
            }
        };
    }());

    /** get_tags_for
     * Utility function to recursively get all tags that apply to a particular function.
     *
     * @param fn
     * @returns {Array}
     */
    function get_tags_for (fn) {
        var matched_tags = [];

        //
        //Start by matching any global tags
        //

        for (var i = 0; i < global_tags.length; i++) {
            matched_tags.push(global_tags[i]);
        }

        //
        //Next match any persistent tags from higher level function calls
        //

        //Make a list of higher-level function UIDs
        var uids = [];
        var caller = fn; //Start with the current function
        while (caller) {

            //Record the UID
            uids.push(caller.getUID());

            //Set the caller to the caller's caller
            caller = caller.caller;
        }

        //Iterate through the found UIDs backwards and add any persistent tags assigned to them
        //Backwards to register the tags from the "oldest" function first
        for (var j = uids.length - 1; j >= 0; j--) {
            if (persistent_tags[uids[j]]) {
                for (var jj = 0; jj < persistent_tags[uids[j]].length; jj++) {
                    matched_tags.push(persistent_tags[uids[j]][jj]);
                }
            }
        }

        //
        //Lastly check the local tags list
        //
        if (local_tags[uids[1]]) { //Start from the 2nd UID entry. The first [0] is 'console.log'.
            for (var k = 0; k < local_tags[uids[1]].length; k++) {
                matched_tags.push(local_tags[uids[1]][k]);
            }
        }

        return matched_tags;
    }

    /** Transformation Functionality
     * Allows the programmer to specify custom transformation functions through which to run a message before it's sent to the console.
     * NOTE that the earliest added transformations will be applied first (queue structure), however this is not guaranteed to
     * be the case in future updates.
     */
    var text_transformers = {
        global: [],
        local: {},
        persistent: {}
    };
    var object_transformers = {
        global: [],
        local: {},
        persistent: {}
    };
    (function () {
        /** Transformation functionality
         * Allows the user to add their own custom functions which transform the console output.
         */

        exporter.transformation = {};

        /** transformation.createLocal
         * Registers a transformer to apply to any logged message within 'fn'
         *
         * @param fn - The function in whose scope to apply the transformer.
         * @param transformer - The transformer to apply.
         */
        exporter.transformation.createLocalText = function (transformer, fn) {
            var uid = fn.getUID();

            text_transformers.local[uid] = text_transformers.local[uid] || [];
            text_transformers.local[uid].push(transformer);
        };
        exporter.transformation.createLocalObject = function (transformer, fn) {
            var uid = fn.getUID();

            object_transformers.local[uid] = object_transformers.local[uid] || [];
            object_transformers.local[uid].push(transformer);
        };

        /** transformation.createGlobal
         * Registers a transformation to be applied to any console log
         *
         * @param transformer - The transformation to apply.
         */
        exporter.transformation.createGlobalText = function (transformer) {
            text_transformers.global.push(transformer);
        };
        exporter.transformation.createGlobalObject = function (transformer) {
            object_transformers.global.push(transformer);
        };

        /** transformation.createPersistent
         * Creates a transformation to be applied to any console.log within 'fn', and to logs in any subsequent child calls.
         *
         * @param fn - The function in whose scope to apply the tag.
         * @param transformer - The transformation to apply.
         */
        exporter.transformation.createPersistentText = function (transformer, fn) {
            var uid = fn.getUID();

            text_transformers.persistent[uid] = text_transformers.persistent[uid] || [];
            text_transformers.persistent[uid].push(transformer);
        };
        exporter.transformation.createPersistentObject = function (transformer, fn) {
            var uid = fn.getUID();

            object_transformers.persistent[uid] = object_transformers.persistent[uid] || [];
            object_transformers.persistent[uid].push(transformer);
        };

        /** transformation.deleteLocal
         * Removes a local transformation associated with a particular function.
         *
         * @param transformer
         * @param fn
         */
        exporter.transformation.deleteLocalText = function (transformer, fn) {
            var uid = fn.getUID();

            if (text_transformers.local[uid].indexOf(transformer) > -1) {
                text_transformers.local[uid].splice(text_transformers.local[uid].indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete local transformation from function \"" + fn.name + "\" because it does not exist."}
            }
        };
        exporter.transformation.deleteLocalObject = function (transformer, fn) {
            var uid = fn.getUID();

            if (object_transformers.local[uid].indexOf(transformer) > -1) {
                object_transformers.local[uid].splice(object_transformers.local[uid].indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete local transformation from function \"" + fn.name + "\" because it does not exist."}
            }
        };

        /** transformation.deleteGlobal
         * Removes a global transformation.
         *
         * @param transformer
         */
        exporter.transformation.deleteGlobalText = function (transformer) {
            if (text_transformers.global.indexOf(transformer) > -1) {
                text_transformers.global.splice(text_transformers.global.indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete global transformation because it does not exist."}
            }
        };
        exporter.transformation.deleteGlobalObject = function (transformer) {
            if (object_transformers.global.indexOf(transformer) > -1) {
                object_transformers.global.splice(object_transformers.global.indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete global transformation because it does not exist."}
            }
        };

        /** transformation.deletePersistent
         * Removes a persistent transformation from a particular function.
         *
         * @param transformer
         * @param fn
         */
        exporter.transformation.deletePersistentText = function (transformer, fn) {
            var uid = fn.getUID();

            if (text_transformers.persistent[uid].indexOf(transformer) > -1) {
                text_transformers.persistent[uid].splice(text_transformers.persistent[uid].indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete persistent transformer from function \"" + fn.name + "\" because it does not exist."}
            }
        };
        exporter.transformation.deletePersistentObject = function (transformer, fn) {
            var uid = fn.getUID();

            if (object_transformers.persistent[uid].indexOf(transformer) > -1) {
                object_transformers.persistent[uid].splice(object_transformers.persistent[uid].indexOf(transformer), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete persistent transformer from function \"" + fn.name + "\" because it does not exist."}
            }
        };

        /** transformation.clearLocal
         * Removes all local transformations associated with a particular function.
         *
         * @param fn
         */
        exporter.transformation.clearLocalText = function (fn) {
            var uid = fn.getUID();

            if (text_transformers.local[uid]) {
                delete text_transformers.local[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear local transformations from function \"" + fn.name + "\" because there are none."}
            }
        };
        exporter.transformation.clearLocalObject = function (fn) {
            var uid = fn.getUID();

            if (object_transformers.local[uid]) {
                delete object_transformers.local[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear local transformations from function \"" + fn.name + "\" because there are none."}
            }
        };

        /** transformations.clearGlobal
         * Removes all global transformations.
         */
        exporter.transformation.clearGlobalText = function () {
            text_transformers.global = [];
        };
        exporter.transformation.clearGlobalObject = function () {
            object_transformers.global = [];
        };

        /** transformations.clearPersistent
         * Removes all persistent transformations from a particular function.
         *
         * @param fn
         */
        exporter.transformation.clearPersistentText = function (fn) {
            var uid = fn.getUID();

            if (text_transformers.persistent[uid]) {
                delete text_transformers.persistent[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear persistent transformations from function \"" + fn.name + "\" because there are none."}
            }
        };
        exporter.transformation.clearPersistentObject = function (fn) {
            var uid = fn.getUID();

            if (object_transformers.persistent[uid]) {
                delete object_transformers.persistent[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear persistent transformations from function \"" + fn.name + "\" because there are none."}
            }
        };
    }());

    /** get_transformers_for
     * Utility functions to get transformers registered for a given function
     * @param fn
     * @returns {Array}
     */
    function get_text_transformers_for (fn) {
        var matched_transformers = [];


        //
        //Start by matching any global transformers
        //

        for (var i = 0; i < text_transformers.global.length; i++) {
            matched_transformers.push(text_transformers.global[i]);
        }


        //
        //Next match any persistent transformers from higher level function calls
        //

        //Make a list of higher-level function UIDs
        var uids = [];
        var caller = fn; //Start with the current function
        while (caller) {

            //Record the UID
            uids.push(caller.getUID());

            //Set the caller to the caller's caller
            caller = caller.caller;
        }

        //Iterate through the found UIDs backwards and apply any persistent transformers assigned to them
        //Backwards to register the transformers from the "oldest" function first
        for (var j = uids.length - 1; j >= 0; j--) {
            if (text_transformers.persistent[uids[j]]) {
                for (var jj = 0; jj < text_transformers.persistent[uids[j]].length; jj++) {
                    matched_transformers.push(text_transformers.persistent[uids[j]][jj]);
                }
            }
        }


        //
        //Lastly check the local s list
        //

        if (text_transformers.local[uids[1]]) { //Start from the 2nd UID entry. The first [0] is 'console.log'.
            for (var k = 0; k < text_transformers.local[uids[1]].length; k++) {
                matched_transformers.push(text_transformers.local[uids[1]][k]);
            }
        }

        return matched_transformers;
    }
    function get_object_transformers_for (fn) {
        var matched_transformers = [];


        //
        //Start by matching any global transformers
        //

        for (var i = 0; i < object_transformers.global.length; i++) {
            matched_transformers.push(object_transformers.global[i]);
        }


        //
        //Next match any persistent transformers from higher level function calls
        //

        //Make a list of higher-level function UIDs
        var uids = [];
        var caller = fn; //Start with the current function
        while (caller) {

            //Record the UID
            uids.push(caller.getUID());

            //Set the caller to the caller's caller
            caller = caller.caller;
        }

        //Iterate through the found UIDs backwards and apply any persistent transformers assigned to them
        //Backwards to register the transformers from the "oldest" function first
        for (var j = uids.length - 1; j >= 0; j--) {
            if (object_transformers.persistent[uids[j]]) {
                for (var jj = 0; jj < object_transformers.persistent[uids[j]].length; jj++) {
                    matched_transformers.push(object_transformers.persistent[uids[j]][jj]);
                }
            }
        }


        //
        //Lastly check the local tags list
        //

        if (object_transformers.local[uids[1]]) { //Start from the 2nd UID entry. The first [0] is 'console.log'.
            for (var k = 0; k < object_transformers.local[uids[1]].length; k++) {
                matched_transformers.push(object_transformers.local[uids[1]][k]);
            }
        }

        return matched_transformers;
    }

    /** clone_fn
     * Utility function to clone native functions (such as console.log), allowing their redefinition
     * while still being able to use their functionality as part of that new definition.
     *
     * @param fn_to_clone
     * @returns {cloned_fn}
     */
    function clone_fn (fn_to_clone) {
        if(fn_to_clone.__isClone) {
            fn_to_clone = fn_to_clone.__clonedFrom;
        }

        var cloned_fn = function() { return fn_to_clone.apply(fn_to_clone, arguments); };
        for(var key in fn_to_clone) {
            if (fn_to_clone.hasOwnProperty(key)) {
                cloned_fn[key] = fn_to_clone[key];
            }
        }

        cloned_fn.__isClone = true;
        cloned_fn.__clonedFrom = fn_to_clone;

        return cloned_fn;
    }

    /** stringify_date
     * Turns a date object into a string of the specified format
     *
     * @param date
     * @param format
     * @returns {string}
     */
    function stringify_date (date, format) {

        //Parse a format token into the correct value
        function parse(token) {
            var ret = token;

            //Make 'ret' the required number of 0's and split it into an array
            ret = ret.replace(/./g, "0").split("");

            //Perform the parse action
            function do_parse(data) {
                for (var i = 0; i < ret.length; i++) {
                    if (data[i]) {
                        ret[ret.length - 1 - i] = data[data.length - 1 - i];
                    } else {
                        break;
                    }
                }

                return ret.join("");
            }

            //Decide which numeric stringified data to feed the 'do_parse' function
            switch(token[0]) {
                case "Y": return do_parse(date.getFullYear().toString());
                case "M": return do_parse((date.getMonth() + 1).toString());
                case "D": return do_parse(date.getDate().toString());
                case "H": return do_parse(date.getHours().toString());
                case "m": return do_parse(date.getMinutes().toString());
                case "S": return do_parse(date.getSeconds().toString());
                case "s": return do_parse(date.getMilliseconds().toString());
                default: {
                    throw {e: "[loggerplus] Error parsing date format - invalid identifier \"" + token + "\""}
                }
            }
        }

        //Find all the tokens in the string
        var token_matches = format.match(/([YMDHmSs])\1*/g);

        //The current starting index for indexOf
        var current_index = 0;

        //The return value
        var arr_format = format.split("");

        //Iterate through the token matches
        for (var i = 0; i < token_matches.length; i++) {

            //Update the current index to the start of the token
            current_index = format.indexOf(token_matches[i], current_index);

            //Do the replacement (which will insert the full string as one element in the array, so we must join it and split it again; below)
            arr_format.splice(current_index, token_matches[i].length, parse(token_matches[i]));

            //Update the current index to the end of the token
            current_index += token_matches[i].length;

            //Normalize the array again
            arr_format = arr_format.join("").split("");
        }

        //Join the array into a string before returning
        return arr_format.join("");
    }

    //Clone console.log and related so that we can redefine it
    var nativeLog = clone_fn(console.log);
    var nativeWarn = clone_fn(console.warn || console.log);
    var nativeError = clone_fn(console.error || console.log);

    //Allow the user to access the vanilla console.log if they choose.
    console.native_log = nativeLog;
    console.native_warn = nativeWarn;
    console.native_error = nativeError;

    //Get the enhanced replacement function based on a native function
    function replace(native_function) {
        return function () {

            //If logging is disabled, don't log anything
            if (settings.disableLogging) {
                return;
            }

            //Store all the data to be prepended to the message; namely tags
            var prepend = "";

            //If we're using the date/time tag
            if (settings.useDateTime) {
                //Initialize 'prepend' with the date/time
                prepend = stringify_date(new Date(), settings.dateTimeFormat) + " ";
            }

            //If we're using custom tags
            if (settings.useTags) {
                //Get all the relevant tags for this call
                var matched_tags = get_tags_for(arguments.callee);

                //Iterate through them
                for (var i = 0; i < matched_tags.length; i++) {
                    //Add them to the prepend string
                    prepend += "[" + matched_tags[i] + "]";
                }
            }

            //Provide a continue function, as we may need to implement asynchronous methods
            function next() {
                //Define text_transformers early as it's used in 'transformTags'
                var text_transformers;

                //If we are transforming the tags too, do so
                if (settings.transformTags) {
                    //Get all relevant transformations
                    text_transformers = get_text_transformers_for(arguments.callee);

                    //Iterate and apply
                    for (var l = 0; l < text_transformers.length; l++) {
                        prepend = text_transformers[l](prepend);
                    }
                }

                //Create an 'args' variable to store the processed arguments.\
                var args = [];
                if (prepend) {
                    args.push(prepend);
                }

                //Iterate through all the arguments
                for (var k = 0; k < arguments.length; k++) {


                    if (settings.useTextTransformations && typeof(arguments[k]) === "string") { //If we're using text transformations and the argument is a string:

                        //We may need to get_text_transformers, or it may have already been defined for 'transformTags'
                        text_transformers = text_transformers || get_text_transformers_for(arguments.callee);

                        //Iterate and apply
                        for (var ki = 0; ki < text_transformers.length; ki++) {
                            arguments[k] = text_transformers[ki](arguments[k]);
                        }
                    } else if (settings.useObjectTransformations && typeof(arguments[k]) === "object") { //If we're using object transformations and the argument is an object:

                        //Object transformers won't have been defined yet
                        var obj_transformers = get_object_transformers_for(arguments.callee);

                        //Iterate and apply
                        for (var kj = 0; kj < obj_transformers.length; kj++) {
                            arguments[k] = obj_transformers[kj](JSON.parse(JSON.stringify(arguments[k])));
                        }
                    }

                    //Once the argument has been processed, add it to the list
                    args.push(arguments[k]);
                }

                //Call the native function to do the console output
                native_function.apply(null, args);
            }

            //Do microtemplate resolution, if applicable
            if (settings.useMicroTemplates) {
                //Declare the template list
                var templateList = {};
                StackTrace.get().then(function (stacktrace) {
                    //Populate the template list
                    var filepath = stacktrace[1]["fileName"];
                    templateList.caller = stacktrace[1]["functionName"];
                    templateList.filename = filepath.split("\\\\")[filepath.length - 1];
                    templateList.filepath = filepath;
                    templateList.linenumber = stacktrace[1]["lineNumber"];
                    templateList.columnNumber = stacktrace[1]["lineNumber"];

                    //Resolve microtemplates in tags
                    prepend = tim(prepend, templateList);

                    //Resolve microtemplates in messages
                    for (var i = 0; i < arguments.length; i++) {
                        if (typeof arguments[i] === "string") {
                            arguments[i] = tim(arguments[i], templateList);
                        }
                    }

                    //Proceed
                    next();
                });
            } else {
                next();
            }
        }
    }

    //Redefine console.log
    console.log = replace(nativeLog);

    //Redefine console.warn
    console.warn = replace(nativeWarn);

    //Redefine console.error
    console.error = replace(nativeError);

}((function () {
    //Determine if we're running in a nodejs instance or in the browser
    if (typeof window === "undefined") { //Running in nodejs

        return module.exports; //Return the module export object

    } else { //Running in the browser

        window.loggerplus = {}; //Create a namespace to which to export
        return window.loggerplus; //Return it as the export object

    }
}())));
(function (exporter) {
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
        dateTimeFormat: "[YYYY-MM-DD, HH:mm:SS.sss]",
        useDateTime: false,
        useTags: false,
        useTransformations: false,
        forceStringifyObjects: false
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

            if (local_tags[uid].indexOf(tag)) {
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
            if (global_tags.indexOf(tag)) {
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

            if (persistent_tags[uid].indexOf(tag)) {
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
    var global_transformers = [];
    var local_transformers = {};
    var persistent_transformers = {};
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
        exporter.transformation.createLocal = function (transformer, fn) {
            var uid = fn.getUID();

            local_transformers[uid] = local_transformers[uid] || [];
            local_transformers[uid].push(transformer);
        };

        /** transformation.createGlobal
         * Registers a transformation to be applied to any console log
         *
         * @param transformer - The transformation to apply.
         */
        exporter.transformation.createGlobal = function (transformer) {
            global_transformers.push(transformer);
        };

        /** transformation.createPersistent
         * Creates a transformation to be applied to any console.log within 'fn', and to logs in any subsequent child calls.
         *
         * @param fn - The function in whose scope to apply the tag.
         * @param transformer - The transformation to apply.
         */
        exporter.transformation.createPersistent = function (transformer, fn) {
            var uid = fn.getUID();

            persistent_transformers[uid] = persistent_transformers[uid] || [];
            persistent_transformers[uid].push(transformer);
        };

        /** transformation.deleteLocal
         * Removes a local transformation associated with a particular function.
         *
         * @param transformer
         * @param fn
         */
        exporter.transformation.deleteLocal = function (transformer, fn) {
            var uid = fn.getUID();

            if (local_transformers[uid].indexOf(transformer)) {
                local_transformers[uid].splice(local_transformers[uid].indexOf(tag), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete local transformation from function \"" + fn.name + "\" because it does not exist."}
            }
        };

        /** transformation.deleteGlobal
         * Removes a global transformation.
         *
         * @param transformer
         */
        exporter.transformation.deleteGlobal = function (transformer) {
            if (global_transformers.indexOf(transformer)) {
                global_transformers.splice(global_transformers.indexOf(transformer), 1);
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
        exporter.transformation.deletePersistent = function (transformer, fn) {
            var uid = fn.getUID();

            if (persistent_transformers[uid].indexOf(transformer)) {
                persistent_transformers[uid].splice(persistent_transformers[uid].indexOf(tag), 1);
            } else {
                throw {e: "[loggerplus] Unable to delete persistent transformer from function \"" + fn.name + "\" because it does not exist."}
            }
        };

        /** transformation.clearLocal
         * Removes all local transformations associated with a particular function.
         *
         * @param fn
         */
        exporter.transformation.clearLocal = function (fn) {
            var uid = fn.getUID();

            if (local_transformers[uid]) {
                delete local_transformers[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear local transformations from function \"" + fn.name + "\" because there are none."}
            }
        };

        /** transformations.clearGlobal
         * Removes all global transformations.
         */
        exporter.transformation.clearGlobal = function () {
            global_transformers = [];
        };

        /** transformations.clearPersistent
         * Removes all persistent transformations from a particular function.
         *
         * @param fn
         */
        exporter.transformation.clearPersistent = function (fn) {
            var uid = fn.getUID();

            if (persistent_transformers[uid]) {
                delete persistent_transformers[uid];
            } else {
                throw {e: "[loggerplus] Unable to clear persistent transformations from function \"" + fn.name + "\" because there are none."}
            }
        };
    }());

    /** get_transformers_for
     * A utility function to get transformers registered for a given function
     * @param fn
     * @returns {Array}
     */
    function get_transformers_for (fn) {
        var matched_transformers = [];


        //
        //Start by matching any global transformers
        //

        for (var i = 0; i < global_transformers.length; i++) {
            matched_transformers.push(global_transformers[i]);
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
            if (persistent_transformers[uids[j]]) {
                for (var jj = 0; jj < persistent_transformers[uids[j]].length; jj++) {
                    matched_transformers.push(persistent_transformers[uids[j]][jj]);
                }
            }
        }


        //
        //Lastly check the local tags list
        //

        if (local_transformers[uids[1]]) { //Start from the 2nd UID entry. The first [0] is 'console.log'.
            for (var k = 0; k < local_transformers[uids[1]].length; k++) {
                matched_transformers.push(local_transformers[uids[1]][k]);
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

            var prepend = "";
            if (settings.useDateTime) {
                prepend = stringify_date(new Date(), settings.dateTimeFormat);
            }

            if (settings.useTags) {
                var matched_tags = get_tags_for(arguments.callee);
                var tags_str = "";
                for (var i = 0; i < matched_tags.length; i++) {
                    tags_str += "[" + matched_tags[i] + "] ";
                }

                prepend += tags_str;
            }

            if (settings.useTransformations) {
                var transformations = get_transformers_for(arguments.callee);
                for (var j = 0; j < transformations.length; j++) {
                    prepend = transformations[j](prepend);
                }
            }

            var args = [];
            args.push(prepend);
            for (var k = 0; k < arguments.length; k++) {
                args.push(arguments[k]);
            }

            //Call the native function to do the console output
            native_function.apply(null, args);
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
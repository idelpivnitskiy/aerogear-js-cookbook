/*! AeroGear JavaScript Library - v2.1.0 - 2015-03-12
* https://github.com/aerogear/aerogear-js
* JBoss, Home of Professional Open Source
* Copyright Red Hat, Inc., and individual contributors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
(function( window, undefined ) {

/**
    The AeroGear namespace provides a way to encapsulate the library's properties and methods away from the global namespace
    @namespace
 */
this.AeroGear = {};

/**
    AeroGear.Core is a base for all of the library modules to extend. It is not to be instantiated and will throw an error when attempted
    @class
    @private
 */
AeroGear.Core = function() {
    // Prevent instantiation of this base class
    if ( this instanceof AeroGear.Core ) {
        throw "Invalid instantiation of base class AeroGear.Core";
    }

    /**
        This function is used by the different parts of AeroGear to add a new Object to its respective collection.
        @name AeroGear.add
        @method
        @param {String|Array|Object} config - This can be a variety of types specifying how to create the object. See the particular constructor for the object calling .add for more info.
        @returns {Object} The object containing the collection that was updated
     */
    this.add = function( config ) {
        var i,
            current,
            collection = this[ this.collectionName ] || {};
        this[ this.collectionName ] = collection;

        if ( !config ) {
            return this;
        } else if ( typeof config === "string" ) {
            // config is a string so use default adapter type
            collection[ config ] = AeroGear[ this.lib ].adapters[ this.type ]( config, this.config );
        } else if ( Array.isArray( config ) ) {
            // config is an array so loop through each item in the array
            for ( i = 0; i < config.length; i++ ) {
                current = config[ i ];

                if ( typeof current === "string" ) {
                    collection[ current ] = AeroGear[ this.lib ].adapters[ this.type ]( current, this.config );
                } else {
                    if( current.name ) {

                        // Merge the Module( authz, datamanger, ... )config with the adapters settings
                        current.settings = AeroGear.extend( current.settings || {}, this.config );

                        collection[ current.name ] = AeroGear[ this.lib ].adapters[ current.type || this.type ]( current.name, current.settings );
                    }
                }
            }
        } else {
            if( !config.name ) {
                return this;
            }

            // Merge the Module( authz, datamanger, ... )config with the adapters settings
            // config is an object so use that signature
            config.settings = AeroGear.extend( config.settings || {}, this.config );

            collection[ config.name ] = AeroGear[ this.lib ].adapters[ config.type || this.type ]( config.name, config.settings );
        }

        // reset the collection instance
        this[ this.collectionName ] = collection;

        return this;
    };
    /**
        This function is used internally by datamanager, etc. to remove an Object (store, etc.) from the respective collection.
        @name AeroGear.remove
        @method
        @param {String|String[]|Object[]|Object} config - This can be a variety of types specifying how to remove the object. See the particular constructor for the object calling .remove for more info.
        @returns {Object} The object containing the collection that was updated
     */
    this.remove = function( config ) {
        var i,
            current,
            collection = this[ this.collectionName ] || {};

        if ( typeof config === "string" ) {
            // config is a string so delete that item by name
            delete collection[ config ];
        } else if ( Array.isArray( config ) ) {
            // config is an array so loop through each item in the array
            for ( i = 0; i < config.length; i++ ) {
                current = config[ i ];

                if ( typeof current === "string" ) {
                    delete collection[ current ];
                } else {
                    delete collection[ current.name ];
                }
            }
        } else if ( config ) {
            // config is an object so use that signature
            delete collection[ config.name ];
        }

        // reset the collection instance
        this[ this.collectionName ] = collection;

        return this;
    };
};

/**
    Utility function to merge many Objects in one target Object which is the first object in arguments list.
    @private
    @method
*/
AeroGear.extend = function() {
    var name, i, source,
        target = arguments[ 0 ];
    for( i=1; i<arguments.length; i++ ) {
        source = arguments[ i ];
        for( name in source ) {
            target[ name ] = source[ name ];
        }
    }
    return target;
};

/**
    The AeroGear Differential Sync Engine.
    @status Experimental
    @constructs AeroGear.DiffSyncEngine
    @param {Object} config - A configuration
    @param {String} [config.type = "jsonPatch"] - the type of sync engine, defaults to jsonPatch
    @returns {Object} diffSyncEngine - The created DiffSyncEngine
 */
AeroGear.DiffSyncEngine = function( config ) {
    if ( !( this instanceof AeroGear.DiffSyncEngine ) ) {
        return new AeroGear.DiffSyncEngine( config );
    }

    this.lib = "DiffSyncEngine";
    this.type = config ? config.type || "jsonPatch" : "jsonPatch";

    return new AeroGear.DiffSyncEngine.adapters[ this.type ]();
};

/**
    The adapters object is provided so that adapters can be added to the AeroGear.DiffSyncEngine namespace dynamically and still be accessible to the add method
    @augments AeroGear.DiffSyncEngine
 */
AeroGear.DiffSyncEngine.adapters = {};

/**
    The diffMatchPatch adapter.
    @status Experimental
    @constructs AeroGear.DiffSyncEngine.adapters.diffMatchPatch
    @returns {Object} The created adapter
 */
AeroGear.DiffSyncEngine.adapters.diffMatchPatch = function() {
    if ( !( this instanceof AeroGear.DiffSyncEngine.adapters.diffMatchPatch ) ) {
        return new AeroGear.DiffSyncEngine.adapters.diffMatchPatch();
    }

    var stores = {
            docs: [],
            shadows: [],
            backups: [],
            edits: []
        },
        dmp = new diff_match_patch();


    /**
     * Adds a new document to this sync engine.
     *
     * @param doc the document to add.
     */
    this.addDocument = function( doc ) {
        this._saveDocument( JSON.parse( JSON.stringify( doc ) ) );
        this._saveShadow( JSON.parse( JSON.stringify( doc ) ) );
        this._saveShadowBackup( JSON.parse( JSON.stringify( doc ) ), 0 );
    };

    /**
     * Performs the client side of a differential sync.
     * When a client makes an update to it's document, it is first diffed against the shadow
     * document. The result of this is an {@link Edits} instance representing the changes.
     * There might be pending edits that represent edits that have not made it to the server
     * for some reason (for example packet drop). If a pending edit exits the contents (the diffs)
     * of the pending edit will be included in the returned Edits from this method.
     *
     * @param doc the updated document.
     * @returns {object} containing the diffs that between the clientDoc and it's shadow doc.
     */
    this.diff = function( doc ) {
        var diffDoc, patchMsg, docContent, shadowContent, pendingEdits,
            shadow = this._readData( doc.id, "shadows" )[ 0 ];

        if ( typeof doc.content === "string" ) {
            docContent = doc.content;
            shadowContent = shadow.content;
        } else {
            docContent = JSON.stringify( doc.content );
            shadowContent = JSON.stringify( shadow.content );
        }

        patchMsg = {
            msgType: "patch",
            id: doc.id,
            clientId: shadow.clientId,
            edits: [{
                clientVersion: shadow.clientVersion,
                serverVersion: shadow.serverVersion,
                // currently not implemented but we probably need this for checking the client and server shadow are identical be for patching.
                checksum: '',
                diffs: this._asAeroGearDiffs( dmp.diff_main( shadowContent, docContent ) )
            }]
        };

        shadow.clientVersion++;
        shadow.content = doc.content;
        this._saveShadow( JSON.parse( JSON.stringify( shadow ) ) );

        // add any pending edits from the store
        pendingEdits = this._getEdits( doc.id );
        if ( pendingEdits && pendingEdits.length > 0 ) {
            patchMsg.edits = pendingEdits.concat( patchMsg.edits );
        }

        return patchMsg;
    };

    /**
     * Performs the client side patch process.
     *
     * @param patchMsg the patch message that is sent from the server
     *
     * @example:
     * {
     *   "msgType":"patch",
     *   "id":"12345",
     *   "clientId":"3346dff7-aada-4d5f-a3da-c93ff0ffc472",
     *   "edits":[{
     *     "clientVersion":0,
     *     "serverVersion":0,
     *     "checksum":"5f9844b21c298ea1f3ed7bf37f96e42df03395b",
     *     "diffs":[
     *       {"operation":"UNCHANGED","text":"I'm a Je"},
     *       {"operation":"DELETE","text":"di"}]
     *   }]
     * }
    */
    this.patch = function( patchMsg ) {
        // Flow is based on the server side
        // patch the shadow
        var patchedShadow = this.patchShadow( patchMsg );
        // Then patch the document
        this.patchDocument( patchedShadow );
        // then save backup shadow
        this._saveShadowBackup( patchedShadow, patchedShadow.clientVersion );

    };

    this._asAeroGearDiffs = function( diffs ) {
        return diffs.map(function( value ) {
            return {
                operation: this._asAgOperation( value[ 0 ] ),
                text: value[ 1 ]
            };
        }.bind( this ) );
    };

    this._asDiffMatchPathDiffs = function( diffs ) {
        return diffs.map( function ( value ) {
            return [this._asDmpOperation ( value.operation ), value.text];
        }.bind( this ) );
    };

    this._asDmpOperation = function( op ) {
        if ( op === "DELETE" ) {
            return -1;
        } else if ( op === "ADD" ) {
            return 1;
        }
        return 0;
    };

    this._asAgOperation = function( op ) {
        if ( op === -1 ) {
            return "DELETE";
        } else if ( op === 1 ) {
            return "ADD";
        }
        return "UNCHANGED";
    };

    this.patchShadow = function( patchMsg ) {
        // First get the shadow document for this doc.id and clientId
        var i, patched, edit,
            shadow = this.getShadow( patchMsg.id ),
            edits = patchMsg.edits;
        //Iterate over the edits of the doc
        for ( i = 0; i < edits.length; i++ ) {
            edit = edits[i];

            //Check for dropped packets?
            // edit.clientVersion < shadow.ClientVersion
            if( edit.clientVersion < shadow.clientVersion && !this._isSeeded( edit ) ) {
                // Dropped packet?  // restore from back
                shadow = this._restoreBackup( shadow, edit );
                continue;
            }

            //check if we already have this one
            // IF SO discard the edit
            // edit.serverVersion < shadow.ServerVesion
            if( edit.serverVersion < shadow.serverVersion ) {
                // discard edit
                this._removeEdit( patchMsg.id, edit );
                continue;
            }

            //make sure the versions match
            if( (edit.serverVersion === shadow.serverVersion && edit.clientVersion === shadow.clientVersion) || this._isSeeded( edit )) {
                // Good ,  Patch the shadow
                this.applyEditsToShadow( edit, shadow );
                if ( this._isSeeded( edit ) ) {
                    shadow.clientVersion = 0;
                } else if ( edit.clientVersion >= 0 ) {
                    shadow.serverVersion++;
                }
                this._saveShadow( shadow );
                this._removeEdit( patchMsg.id, edit );
            }
        }

        //console.log('patched:', shadow);
        return shadow;
    };

    // A seeded patch is when all clients start with a base document. They all send this base version as
    // part of the addDocument call. The server will respond with a patchMsg enabling the client to
    // patch it's local version to get the latest updates. Such an edit is identified by a clientVersion
    // set to '-1'.
    this._isSeeded = function( edit ) {
        return edit.clientVersion === -1;
    };

    this.applyEditsToShadow = function ( edits, shadow ) {
        var doc, diffs, patches, patchResult;

        doc = typeof shadow.content === 'string' ? shadow.content : JSON.stringify( shadow.content );
        diffs = this._asDiffMatchPathDiffs( edits.diffs );
        patches = dmp.patch_make( doc, diffs );

        patchResult = dmp.patch_apply( patches, doc );
        try {
            shadow.content = JSON.parse( patchResult[ 0 ] );
        } catch( e ) {
            shadow.content = patchResult[ 0 ];
        }
        return shadow;
    };

    this.patchDocument = function( shadow ) {
        var doc, diffs, patches, patchApplied;

        // first get the document based on the shadowdocs ID
        doc = this.getDocument( shadow.id );

        // diff the doc and shadow and patch that shizzel
        diffs = dmp.diff_main( JSON.stringify( doc.content ), JSON.stringify( shadow.content ) );

        patches = dmp.patch_make( JSON.stringify( doc.content ), diffs );

        patchApplied = dmp.patch_apply( patches, JSON.stringify( doc.content ) );

        //save the newly patched document
        doc.content = JSON.parse( patchApplied[ 0 ] );

        this._saveDocument( doc );

        //return the applied patch?
        //console.log('patches: ', patchApplied);
        return patchApplied;
    };

    this._saveData = function( data, type ) {
        data = Array.isArray( data ) ? data : [ data ];

        stores[ type ] = data;
    };

    this._readData = function( id, type ) {
        return stores[ type ].filter( function( doc ) {
            return doc.id === id;
        });
    };

    this._saveDocument = function( doc ) {
        this._saveData( doc, "docs" );
        return doc;
    };

    this._saveShadow = function( doc ) {
        var shadow = {
            id: doc.id,
            serverVersion: doc.serverVersion || 0,
            clientId: doc.clientId,
            clientVersion: doc.clientVersion || 0,
            content: doc.content
        };

        this._saveData( shadow, "shadows" );
        return shadow;
    };

    this._saveShadowBackup = function( shadow, clientVersion ) {
        var backup = { id: shadow.id, clientVersion: clientVersion, content: shadow.content };
        this._saveData( backup, "backups" );
        return backup;
    };

    this.getDocument = function( id ) {
        return this._readData( id, "docs" )[ 0 ];
    };

    this.getShadow = function( id ) {
        return this._readData( id, "shadows" )[ 0 ];
    };

    this.getBackup = function( id ) {
        return this._readData( id, "backups" )[ 0 ];
    };

    this._saveEdits = function( patchMsg ) {
        var record = { id: patchMsg.id, clientId: patchMsg.clientId, edits: patchMsg.edits};
        this._saveData( record, "edits" );
        return record;
    };

    this._getEdits = function( id ) {
        var patchMessages = this._readData( id, "edits" );

        return patchMessages.length ? patchMessages.edits : [];
    };

    this._removeEdit = function( documentId,  edit ) {
        var pendingEdits = this._readData( documentId, "edits" ), i, j, pendingEdit;
        for ( i = 0; i < pendingEdits.length; i++ ) {
            pendingEdit = pendingEdits[i];
            for ( j = 0; j < pendingEdit.edits.length; j++) {
                if ( pendingEdit.edits[j].serverVersion === edit.serverVersion && pendingEdit.edits[j].clientVersion <= edit.clientVersion) {
                    pendingEdit.edits.splice(i, 1);
                    break;
                }
            }
        }
    };

    this._removeEdits = function( documentId ) {
        var edits = this._readData( documentId, "edits" ), i;
        edits.splice(0, edits.length);
    };

    this._restoreBackup = function( shadow, edit) {
        var patchedShadow, restoredBackup,
            backup = this.getBackup( shadow.id );

        if ( edit.clientVersion === backup.clientVersion ) {

            restoredBackup = {
                id: backup.id,
                clientVersion: backup.clientVersion,
                content: backup.content
            };

            patchedShadow = this.applyEditsToShadow( edit, restoredBackup );
            restoredBackup.serverVersion++;
            this._removeEdits( shadow.id );

            return this._saveShadow( patchedShadow );
        } else {
            throw "Edit's clientVersion '" + edit.clientVersion + "' does not match the backups clientVersion '" + backup.clientVersion + "'";
        }
    };
};

/**
    The jsonPath adapter.
    @status Experimental
    @constructs AeroGear.DiffSyncEngine.adapters.jsonPatch
    @returns {Object} The created adapter
 */
AeroGear.DiffSyncEngine.adapters.jsonPatch = function() {
    if ( !( this instanceof AeroGear.DiffSyncEngine.adapters.jsonPatch ) ) {
        return new AeroGear.DiffSyncEngine.adapters.jsonPatch();
    }

    var stores = {
        docs: [],
        shadows: [],
        backups: [],
        edits: []
    };

    /**
     * Adds a new document to this sync engine.
     *
     * @param doc the document to add.
     */
    this.addDocument = function( doc ) {
        this._saveDocument( JSON.parse( JSON.stringify( doc ) ) );
        this._saveShadow( JSON.parse( JSON.stringify( doc ) ) );
        this._saveShadowBackup( JSON.parse( JSON.stringify( doc ) ), 0 );
    };

    /**
     * Performs the client side of a differential sync.
     * When a client makes an update to it's document, it is first diffed against the shadow
     * document. The result of this is an {@link Edits} instance representing the changes.
     * There might be pending edits that represent edits that have not made it to the server
     * for some reason (for example packet drop). If a pending edit exits the contents (the diffs)
     * of the pending edit will be included in the returned Edits from this method.
     *
     * @param doc the updated document.
     * @returns {object} containing the diffs that between the clientDoc and it's shadow doc.
     */
    this.diff = function( doc ) {
        var patchMsg, pendingEdits,
            shadow = this._readData( doc.id, "shadows" )[ 0 ];

        patchMsg = {
            msgType: "patch",
            id: doc.id,
            clientId: shadow.clientId,
            edits: [{
                clientVersion: shadow.clientVersion,
                serverVersion: shadow.serverVersion,
                // currently not implemented but we probably need this for checking the client and server shadow are identical be for patching.
                checksum: '',
                diffs: jsonpatch.compare( shadow.content, doc.content )
            }]
        };

        shadow.clientVersion++;
        shadow.content = doc.content;
        this._saveShadow( JSON.parse( JSON.stringify( shadow ) ) );

        // add any pending edits from the store
        pendingEdits = this._getEdits( doc.id );
        if ( pendingEdits && pendingEdits.length > 0 ) {
            patchMsg.edits = pendingEdits.concat( patchMsg.edits );
        }

        return patchMsg;
    };

    /**
     * Performs the client side patch process.
     *
     * @param patchMsg the patch message that is sent from the server
     *
     * @example:
     * {
     *   "msgType":"patch",
     *   "id":"12345",
     *   "clientId":"3346dff7-aada-4d5f-a3da-c93ff0ffc472",
     *   "edits":[{
     *     "clientVersion":0,
     *     "serverVersion":0,
     *     "checksum":"5f9844b21c298ea1f3ed7bf37f96e42df03395b",
     *     "diffs":[
     *       {"operation":"UNCHANGED","text":"I'm a Je"},
     *       {"operation":"DELETE","text":"di"}]
     *   }]
     * }
    */
    this.patch = function( patchMsg ) {
        // Flow is based on the server side
        // patch the shadow
        var patchedShadow = this.patchShadow( patchMsg );
        // Then patch the document
        this.patchDocument( patchedShadow );
        // then save backup shadow
        this._saveShadowBackup( patchedShadow, patchedShadow.clientVersion );

    };

    this.patchShadow = function( patchMsg ) {
        // First get the shadow document for this doc.id and clientId
        var i, patched, edit,
            shadow = this.getShadow( patchMsg.id ),
            edits = patchMsg.edits;
        //Iterate over the edits of the doc
        for ( i = 0; i < edits.length; i++ ) {
            edit = edits[i];

            //Check for dropped packets?
            // edit.clientVersion < shadow.ClientVersion
            if( edit.clientVersion < shadow.clientVersion && !this._isSeeded( edit ) ) {
                // Dropped packet?  // restore from back
                shadow = this._restoreBackup( shadow, edit );
                continue;
            }

            //check if we already have this one
            // IF SO discard the edit
            // edit.serverVersion < shadow.ServerVesion
            if( edit.serverVersion < shadow.serverVersion ) {
                // discard edit
                this._removeEdit( patchMsg.id, edit );
                continue;
            }

            //make sure the versions match
            if( (edit.serverVersion === shadow.serverVersion && edit.clientVersion === shadow.clientVersion) || this._isSeeded( edit )) {
                // Good ,  Patch the shadow
                this.applyEditsToShadow( edit, shadow );
                if ( this._isSeeded( edit ) ) {
                    shadow.clientVersion = 0;
                } else if ( edit.clientVersion >= 0 ) {
                    shadow.serverVersion++;
                }
                this._saveShadow( shadow );
                this._removeEdit( patchMsg.id, edit );
            }
        }

        return shadow;
    };

    // A seeded patch is when all clients start with a base document. They all send this base version as
    // part of the addDocument call. The server will respond with a patchMsg enabling the client to
    // patch it's local version to get the latest updates. Such an edit is identified by a clientVersion
    // set to '-1'.
    this._isSeeded = function( edit ) {
        return edit.clientVersion === -1;
    };

    this.applyEditsToShadow = function ( edits, shadow ) {
        var patchResult;
        // returns true or false,  should probably do something with it?
        patchResult = jsonpatch.apply( shadow.content, edits.diffs );
        return shadow;
    };

    this.patchDocument = function( shadow ) {
        var doc, diffs, patch;

        // first get the document based on the shadowdocs ID
        doc = this.getDocument( shadow.id );

        diffs = jsonpatch.compare( doc.content, shadow.content );

        patch = jsonpatch.apply( doc.content, diffs );

        //save the newly patched document,  do we save if the apply failed?
        this._saveDocument( doc );

        return patch;
    };

    this._saveData = function( data, type ) {
        data = Array.isArray( data ) ? data : [ data ];

        stores[ type ] = data;
    };

    this._readData = function( id, type ) {
        return stores[ type ].filter( function( doc ) {
            return doc.id === id;
        });
    };

    this._saveDocument = function( doc ) {
        this._saveData( doc, "docs" );
        return doc;
    };

    this._saveShadow = function( doc ) {
        var shadow = {
            id: doc.id,
            serverVersion: doc.serverVersion || 0,
            clientId: doc.clientId,
            clientVersion: doc.clientVersion || 0,
            content: doc.content
        };

        this._saveData( shadow, "shadows" );
        return shadow;
    };

    this._saveShadowBackup = function( shadow, clientVersion ) {
        var backup = { id: shadow.id, clientVersion: clientVersion, content: shadow.content };
        this._saveData( backup, "backups" );
        return backup;
    };

    this.getDocument = function( id ) {
        return this._readData( id, "docs" )[ 0 ];
    };

    this.getShadow = function( id ) {
        return this._readData( id, "shadows" )[ 0 ];
    };

    this.getBackup = function( id ) {
        return this._readData( id, "backups" )[ 0 ];
    };

    this._saveEdits = function( patchMsg ) {
        var record = { id: patchMsg.id, clientId: patchMsg.clientId, edits: patchMsg.edits};
        this._saveData( record, "edits" );
        return record;
    };

    this._getEdits = function( id ) {
        var patchMessages = this._readData( id, "edits" );

        return patchMessages.length ? patchMessages.edits : [];
    };

    this._removeEdit = function( documentId,  edit ) {
        var pendingEdits = this._readData( documentId, "edits" ), i, j, pendingEdit;
        for ( i = 0; i < pendingEdits.length; i++ ) {
            pendingEdit = pendingEdits[i];
            for ( j = 0; j < pendingEdit.edits.length; j++) {
                if ( pendingEdit.edits[j].clientVersion <= edit.clientVersion) {
                    pendingEdit.edits.splice(i, 1);
                    break;
                }
            }
        }
    };

    this._removeEdits = function( documentId ) {
        var edits = this._readData( documentId, "edits" ), i;
        edits.splice(0, edits.length);
    };

    this._restoreBackup = function( shadow, edit) {
        var patchedShadow, restoredBackup,
            backup = this.getBackup( shadow.id );

        if ( edit.clientVersion === backup.clientVersion ) {

            restoredBackup = {
                id: backup.id,
                clientVersion: backup.clientVersion,
                content: backup.content
            };

            patchedShadow = this.applyEditsToShadow( edit, restoredBackup );
            restoredBackup.serverVersion++;
            this._removeEdits( shadow.id );

            return this._saveShadow( patchedShadow );
        } else {
            throw "Edit's clientVersion '" + edit.clientVersion + "' does not match the backups clientVersion '" + backup.clientVersion + "'";
        }
    };
};

/**
    The AeroGear Differential Sync Client.
    @status Experimental
    @constructs AeroGear.DiffSyncClient
    @param {Object} config - A configuration
    @param {String} config.serverUrl - the url of the Differential Sync Server
    @param {Object} [config.syncEngine="AeroGear.DiffSyncEngine"] -
    @param {function} [config.onopen] - will be called when a connection to the sync server has been opened
    @param {function} [config.onclose] - will be called when a connection to the sync server has been closed
    @param {function} [config.onsync] - listens for "sync" events from the sync server
    @param {function} [config.onerror] - will be called when there are errors from the sync server
    @returns {object} diffSyncClient - The created DiffSyncClient
 */
AeroGear.DiffSyncClient = function ( config ) {
    if ( ! ( this instanceof AeroGear.DiffSyncClient ) ) {
        return new AeroGear.DiffSyncClient( config );
    }

    config = config || {};

    var ws,
        sendQueue = [],
        that = this,
        syncEngine = config.syncEngine || new AeroGear.DiffSyncEngine();

    if ( config.serverUrl === undefined ) {
        throw new Error( "'config.serverUrl' must be specified" );
    }

    /**
        Connects to the Differential Sync Server using WebSockets
    */
    this.connect = function() {
        ws = new WebSocket( config.serverUrl );
        ws.onopen = function ( e ) {
            if ( config.onopen ) {
                config.onopen.apply( this, arguments );
            }

            while ( sendQueue.length ) {
                var task = sendQueue.pop();
                if ( task.type === "add" ) {
                    send ( task.type, task.msg );
                } else {
                    that.sendEdits( task.msg );
                }
            }
        };
        ws.onmessage = function( e ) {
            var data, doc;

            try {
                data = JSON.parse( e.data );
            } catch( err ) {
                data = {};
            }

            if ( data ) {
                that._patch( data );
            }

            doc = that.getDocument( data.id );

            if( config.onsync ) {
                config.onsync.call( this, doc, e );
            }
        };
        ws.onerror = function( e ) {
            if ( config.onerror ) {
                config.onerror.apply( this, arguments );
            }
        };
        ws.onclose = function( e ) {
            if ( config.onclose ) {
                 config.onclose.apply( this, arguments);
            }
        };
    };

    // connect needs to be callable for implementing reconnect.
    this.connect();

    /**
        Disconnects from the Differential Sync Server closing it's Websocket connection
    */
    this.disconnect = function() {
        ws.close();
    };

    /**
        patch - an internal method to sync the data with the Sync Engine
        @param {Object} data - The data to be patched
    */
    this._patch = function( data ) {
        syncEngine.patch( data );
    };

    /**
        getDocument - gets the document from the Sync Engine
        @param {String} id - the id of the document to get
        @returns {Object} - The document from the sync engine
    */
    this.getDocument = function( id ) {
        return syncEngine.getDocument( id );
    };

    /**
        diff - an internal method to perform a diff with the Sync Server
        @param {Object} data - the data to perform a diff on
        @returns {Object} - An Object containing the edits from the Sync Engine
    */
    this._diff = function( data ) {
        return syncEngine.diff( data );
    };

    /**
        addDocument - Adds a document to the Sync Engine
        @param {Object} doc - a document to add to the sync engine
    */
    this.addDocument = function( doc ) {
        syncEngine.addDocument( doc );

        if ( ws.readyState === 0 ) {
            sendQueue.push( { type: "add", msg: doc } );
        } else if ( ws.readyState === 1 ) {
            send( "add", doc );
        }
    };

    /**
        sendEdits - an internal method to send the edits from the Sync Engine to the Sync Server
        @param {Object} edit - the edits to be sent to the server
    */
    this._sendEdits = function( edit ) {
        if ( ws.readyState === WebSocket.OPEN ) {
            //console.log( 'sending edits:', edit );
            ws.send( JSON.stringify( edit ) );
        } else {
            //console.log("Client is not connected. Add edit to queue");
            if ( sendQueue.length === 0 ) {
                sendQueue.push( { type: "patch", msg: edit } );
            } else {
                var updated = false;
                for (var i = 0 ; i < sendQueue.length; i++ ) {
                    var task = sendQueue[i];
                    if (task.type === "patch" && task.msg.clientId === edit.clientId && task.msg.id === edit.id) {
                        for (var j = 0 ; j < edit.edits.length; j++) {
                            task.msg.edits.push( edit.edits[j] );
                        }
                        updated = true;
                    }
                }
                if ( !updated ) {
                    sendQueue.push( { type: "patch", msg: edit } );
                }
            }
        }
    };

    /**
        sync - performs the Sync process
        @param {Object} data - the Data to be sync'd with the server
    */
    this.sync = function( data ) {
        var edits = that._diff( data );
        that._sendEdits( edits );
    };

    /**
        removeDoc
        TODO
    */
    this.removeDoc = function( doc ) {
        throw new Error( "Method Not Yet Implemented" );
    };

    /**
        fetch - fetch a document from the Sync Server.  Will perform a sync on it
        @param {String} docId - the id of a document to fetch from the Server
    */
    this.fetch = function( docId ) {
        var doc, edits, task;

        if ( sendQueue.length === 0 ) {
            doc = syncEngine.getDocument( docId );
            that.sync( doc );
        } else {
            while ( sendQueue.length ) {
                task = sendQueue.shift();
                if ( task.type === "add" ) {
                    send ( task.type, task.msg );
                } else {
                    that._sendEdits( task.msg );
                }
            }
        }
    };

    /**
        send
        @param {String} msgType
        @param {Object} doc
    */
    var send = function ( msgType, doc ) {
        var json = { msgType: msgType, id: doc.id, clientId: doc.clientId, content: doc.content };
        //console.log ( 'sending ' + JSON.stringify ( json ) );
        ws.send( JSON.stringify ( json ) );
    };
};
})( this );

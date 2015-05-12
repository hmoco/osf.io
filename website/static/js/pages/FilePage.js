'use strict';
var ko = require('knockout');
var $ = require('jquery');

var $osf = require('js/osfHelpers');
var mathrender = require('js/mathrender');
var md = require('js/markdown').full;
var mdQuick = require('js/markdown').quick;
var diffTool = require('js/diffTool');

var THROTTLE = 500;

ko.bindingHandlers.mathjaxify = {
    update: function(element, valueAccessor, allBindingsAccessor, data, context) {
        var vm = context.$data;
        //Need to unwrap the data in order for KO to know it's changed.
        ko.unwrap(valueAccessor());

        if(vm.allowMathjaxification() && vm.allowFullRender()) {
            mathrender.mathjaxify('#' + element.id);
        }
    }
};


function ViewWidget(visible, version, viewText, rendered, contentURL, allowMathjaxification, allowFullRender, editor) {
    var self = this;
    self.version = version;
    self.viewText = viewText; // comes from EditWidget.viewText
    self.rendered = rendered;
    self.visible = visible;
    self.allowMathjaxification = allowMathjaxification;
    self.editor = editor;
    self.allowFullRender = allowFullRender;
    self.renderTimeout = null;
    self.displaySource = ko.observable('');
    self.debouncedAllowFullRender = $osf.debounce(function() {
        self.allowFullRender(true);
    }, THROTTLE);

    self.renderMarkdown = function(rawContent){
        if(self.visible()) {
            if (self.allowFullRender()) {
                return md.render(rawContent);
            } else {
                return mdQuick.render(rawContent);
            }
        } else {
            return '';
        }
    };

    if (typeof self.editor !== 'undefined') {
        self.editor.on('change', function () {
            if(self.version() === 'preview') {
                // Quick render
                self.allowFullRender(false);

                // Full render
                self.debouncedAllowFullRender();
            }
        });
    } else {
        self.allowFullRender(true);
    }
}

var defaultOptions = {
    editVisible: true,
    viewVisible: false,
    canEdit: true,
    viewVersion: 'current',
    urls: {
        content: '',
        draft: '',
        page: ''
    },
    metadata: {}
};

function ViewModel(options){
    var self = this;

    // enabled?
    self.editVis = ko.observable(options.editVisible);
    self.viewVis = ko.observable(options.viewVisible);
    // singleVis : checks if the item visible is the only visible column
    self.singleVis = ko.pureComputed(function(){
        var visible = 0;
        var single;
        if(self.editVis()){
            visible++;
            single = 'edit';
        }
        if(self.viewVis()){
            visible++;
            single = 'view';
        }
        if(visible === 1){
            return single;
        }
        return false;
    });

    self.pageTitle = $(document).find('title').text();

    self.viewVersion = ko.observable(options.viewVersion);
    self.draftURL = options.urls.draft;
    self.contentURL = options.urls.content;
    self.pageURL = options.urls.page;
    self.editorMetadata = options.metadata;
    self.canEdit = options.canEdit;
    self.isEditable = options.isEditable;

    self.viewText = ko.observable('');
    self.renderedView = ko.observable('');
    self.renderedCompare = ko.observable('');
    self.allowMathjaxification = ko.observable(true);
    self.allowFullRender = ko.observable(true);

    // Save initial query params (except for the "mode" query params, which are handled
    // by self.currentURL), so that we can preserve them when we mutate window.history.state
    var initialParams = $osf.urlParams();
    delete initialParams.view;
    delete initialParams.edit;
    self.initialQueryParams = $.param(initialParams);

    if(self.canEdit && self.isEditable) {
        self.editor = ace.edit('editor'); // jshint ignore: line

        var ShareJSDoc = require('./ShareJSDocFile.js');
        self.editVM = new ShareJSDoc(self.draftURL, self.editorMetadata, self.viewText, self.editor);
    }
    self.viewVM = new ViewWidget(self.viewVis, self.viewVersion, self.viewText, self.renderedView, self.contentURL, self.allowMathjaxification, self.allowFullRender, self.editor);

}

var FilePage = function(selector, options) {
    var self = this;
    self.options = $.extend({}, defaultOptions, options);

    this.viewModel = new ViewModel(self.options);
    $osf.applyBindings(self.viewModel, selector);
};

module.exports = FilePage;


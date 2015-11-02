var $ = require('jquery');
var m = require('mithril');
var $osf = require('js/osfHelpers');
var FileViewPage = require('js/filepage');
var waterbutler = require('js/waterbutler');

require('jquery-tagsinput');

m.mount(document.getElementsByClassName('file-view-panels')[0], FileViewPage(window.contextVars));

var tagUrl = '/api/v1/project/' + window.contextVars.node.id + '/osfstorage' + window.contextVars.file.path + '/tags/';

$(function() {
    // Tag input
    $('#fileTags').tagsInput({
        width: '100%',
        interactive: window.contextVars.currentUser.canEdit,
        maxChars: 128,
        onAddTag: function (tag) {
            var url = tagUrl;
            var request = $osf.postJSON(url, {'tag': tag });
            request.fail(function (xhr, textStatus, error) {
                $osf.growl('Error', 'Could not add tag.');
                Raven.captureMessage('Failed to add tag', {
                    tag: tag, url: url, textStatus: textStatus, error: error
                });
            });
        },
        onRemoveTag: function (tag) {
            var request = $.ajax({
                url: tagUrl,
                type: 'DELETE',
                contentType: 'application/json',
                dataType: 'JSON',
                content: {'tag': tag }
            });
            request.fail(function (xhr, textStatus, error) {
                $osf.growl('Error', 'Could not remove tag.');
                Raven.captureMessage('Failed to remove tag', {
                    tag: tag, url: url, textStatus: textStatus, error: error
                });
            });
        }
    });
});

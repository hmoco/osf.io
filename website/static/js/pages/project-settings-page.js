'use strict';

var $ = require('jquery');
var bootbox = require('bootbox');
var Raven = require('raven-js');
var ko = require('knockout');

var ProjectSettings = require('js/projectSettings.js');

var $osf = require('js/osfHelpers');
require('css/addonsettings.css');

var ctx = window.contextVars;

// Initialize treebeard grid
var ProjectNotifications = require('js/notificationsTreebeard.js');
var $notificationsMsg = $('#configureNotificationsMessage');
var notificationsURL = ctx.node.urls.api  + 'subscriptions/';
// Need check because notifications settings don't exist on registration's settings page
if ($('#grid').length) {
    $.ajax({
        url: notificationsURL,
        type: 'GET',
        dataType: 'json'
    }).done(function(response) {
        new ProjectNotifications(response);
    }).fail(function(xhr, status, error) {
        $notificationsMsg.addClass('text-danger');
        $notificationsMsg.text('Could not retrieve notification settings.');
        Raven.captureMessage('Could not GET notification settings', {
            url: notificationsURL, status: status, error: error
        });
    });
}

$(document).ready(function() {

    // Apply KO bindings for Node Category Settings
    var categories = [];
    var keys = Object.keys(window.contextVars.nodeCategories);
    for (var i = 0; i < keys.length; i++) {
        categories.push({
            label: window.contextVars.nodeCategories[keys[i]],
            value: keys[i]
        });
    }
    var disableCategory = !window.contextVars.node.parentExists;
    // need check because node category doesn't exist for registrations
    if ($('#nodeCategorySettings').length) {
        var categorySettingsVM = new ProjectSettings.NodeCategorySettings(
            window.contextVars.node.category,
            categories,
            window.contextVars.node.urls.update,
            disableCategory
        );
        $osf.applyBindings(categorySettingsVM, $('#nodeCategorySettings')[0]);
    }

    $('#deleteNode').on('click', function() {
        ProjectSettings.getConfirmationCode(ctx.node.nodeType);
    });
    $('#home_btn').on('click', function() {
        $osf.postJSON(
            '/api/v1/project/' + ctx.node.id + '/new_home/',
            {home: $('#home_address').val()}
        ).done(function(resp) {
            if (resp.status === 'success') {
                $osf.growl('You\'ve changed the home',{ type: 'success' });
            } else {
                $osf.growl('Error', 'New home path not valid');
            }
        }).fail(function(resp) {
            $osf.growl('Error', 'Unable to change home');
       });
    });
    // TODO: Knockout-ify me
    $('#commentSettings').on('submit', function() {
        var $commentMsg = $('#configureCommentingMessage');

        var $this = $(this);
        var commentLevel = $this.find('input[name="commentLevel"]:checked').val();

        $osf.postJSON(
            ctx.node.urls.api + 'settings/comments/',
            {commentLevel: commentLevel}
        ).done(function() {
            $commentMsg.text('Successfully updated settings.');
            $commentMsg.addClass('text-success');
            if($osf.isSafari()){
                //Safari can't update jquery style change before reloading. So delay is applied here
                setTimeout(function(){window.location.reload();}, 100);
            } else {
                window.location.reload();
            }

        }).fail(function() {
            bootbox.alert({
                message: 'Could not set commenting configuration. Please try again.',
                buttons:{
                    ok:{
                        label:'Close',
                        className:'btn-default'
                    }
                }
            });
        });

        return false;

    });

    var checkedOnLoad = $('#selectAddonsForm input:checked');
    var uncheckedOnLoad = $('#selectAddonsForm input:not(:checked)');

    // Set up submission for addon selection form
    $('#selectAddonsForm').on('submit', function() {

        var formData = {};
        $('#selectAddonsForm').find('input').each(function(idx, elm) {
            var $elm = $(elm);
            formData[$elm.attr('name')] = $elm.is(':checked');
        });
        var msgElm = $(this).find('.addon-settings-message');
        $.ajax({
            url: ctx.node.urls.api + 'settings/addons/',
            data: JSON.stringify(formData),
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            success: function() {
                msgElm.text('Settings updated').fadeIn();
                checkedOnLoad = $('#selectAddonsForm input:checked');
                uncheckedOnLoad = $('#selectAddonsForm input:not(:checked)');
                if($osf.isSafari()){
                    //Safari can't update jquery style change before reloading. So delay is applied here
                    setTimeout(function(){window.location.reload();}, 100);
                } else {
                    window.location.reload();
                }
            }
        });

        return false;

    });

    /* Before closing the page, Check whether the newly checked addon are updated or not */
    $(window).on('beforeunload',function() {
      //new checked items but not updated
      var checked = uncheckedOnLoad.filter('#selectAddonsForm input:checked');
      //new unchecked items but not updated
      var unchecked = checkedOnLoad.filter('#selectAddonsForm input:not(:checked)');

      if(unchecked.length > 0 || checked.length > 0) {
        return 'The changes on addon setting are not submitted!';
      }
    });

    // Show capabilities modal on selecting an addon; unselect if user
    // rejects terms
    $('.addon-select').on('change', function() {
        var that = this,
            $that = $(that);
        if ($that.is(':checked')) {
            var name = $that.attr('name');
            var capabilities = $('#capabilities-' + name).html();
            if (capabilities) {
                bootbox.confirm({
                    message: capabilities,
                    callback: function(result) {
                        if (!result) {
                            $(that).attr('checked', false);
                        }
                    },
                    buttons:{
                        confirm:{
                            label:'Confirm'
                        }
                    }
               });
            }
        }
    });

});



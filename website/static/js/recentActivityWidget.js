var $ = require('jquery');
var m = require('mithril');
var moment = require('moment');
var $osf = require('js/osfHelpers');
var LogText = require('js/logTextParser');
var pips = require('sliderPips');

var xhrconfig = function (xhr) {
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/vnd.api+json');
    xhr.setRequestHeader('Accept', 'application/vnd.api+json; ext=bulk');

};

var LogWrap = {
    controller: function(args){
        var self = this;
        self.userId = args.userId;
        self.activityLogs = m.prop();
        self.eventFilter = false;
        self.dateEnd = moment.utc();
        self.dateBegin = moment.utc();
        self.today = moment.utc();
        self.sixMonthsAgo = moment.utc().subtract(6, 'months');
        self.page = 1;
        self.cache = [];
        self.loading = false;
        self.div = 8.64e+7;
        self.canvasHeight = 40;

        self.getLogs = function(init, reset, update) {
            if (!(init || reset || update)  && self.cache[self.page - 1]){
                self.activityLogs(self.cache[self.page - 1]);
                if (!self.cache[self.page] && self.page < self.lastPage){
                    self.page = self.page + 1;
                    self.getLogs(false, false, true);
                    self.page = self.page - 1;
                }
                return;
            }
            var query = {
                'embed': ['nodes', 'user', 'linked_node', 'template_node'],
                'page': ((self.page/2) | 0) + 1,
                'page[size]': 20
            };
            if (self.eventFilter) {
                query['filter[action]'] = self.eventFilter;
            }
            if (init || reset) {
                query.aggregate = 1;
            }
            if (!init) {
                query['filter[date][lte]'] = self.dateEnd.toISOString();
                query['filter[date][gte]'] = self.dateBegin.toISOString();
            }
            var url = $osf.apiV2Url('users/' + self.userId + '/node_logs/', { query : query});
            var promise = m.request({method : 'GET', url : url, config : xhrconfig, background: (update ? true : false)});
            promise.then(function(result){
                self.loading = false;
                result.data.map(function(log){
                    log.attributes.formattableDate = new $osf.FormattableDate(log.attributes.date);
                });
                if (init) {
                    self.lastDay = moment.utc(result.data[0].attributes.date);
                    self.dateEnd = self.lastDay;
                    var firstDay = moment.utc(result.links.meta.last_log_date);
                    self.firstDay = ((firstDay >= self.sixMonthsAgo) ? firstDay : self.sixMonthsAgo).startOf('month');
                    var dateBegin = moment.utc(result.data[0].attributes.date).subtract(1, 'months');
                    self.dateBegin = ((dateBegin > self.firstDay) ? dateBegin : self.firstDay).startOf('day');
                    if ((self.today - self.firstDay)/2629746000 < 1){
                        self.div = self.div/4;
                        self.formatFloat = 'Do h a';
                        self.steps = 14;
                        self.formatPip = 'MMM Do';
                    } else if ((self.today - self.firstDay)/2629746000 < 3){
                        self.div = self.div/2;
                        self.formatFloat = 'MMM Do h';
                        self.steps = 28;
                        self.formatPip = 'MMM Do';
                    } else {
                        self.formatFloat = 'MMM Do';
                        self.steps = 31;
                        self.formatPip = 'MMM';
                    }
                }
                if (init || reset){
                    self.totalEvents = result.links.meta.total;
                    self.eventNumbers = result.links.meta.aggregates;
                    self.cache = [];
                }
                if (!init) {
                    self.cache.push(result.data.slice(0,9));
                    self.cache.push(result.data.slice(10,19));
                    if (!update) {
                        self.activityLogs(self.cache[self.page - 1]);
                    }
                }
                self.lastPage = (result.links.meta.total / (result.links.meta.per_page/2) | 0) + 1;
            });
            return promise;
        };

        self.callLogs = function(filter) {
            self.eventFilter = self.eventFilter === filter ? false : filter;
            self.page = 1;
            self.cache = [];
            self.getLogs();
        };

        self.getLogs(true, false);
    },
    view: function(ctrl, args){
        var fileEvents = ((ctrl.eventNumbers.files/ctrl.totalEvents)*100 | 0) + (ctrl.eventNumbers.files ? 5 : 0);
        var commentEvents = ((ctrl.eventNumbers.comments/ctrl.totalEvents)*100 | 0) + (ctrl.eventNumbers.comments ? 5 : 0);
        var wikiEvents = ((ctrl.eventNumbers.wiki/ctrl.totalEvents)*100 | 0) + (ctrl.eventNumbers.wiki ? 5 : 0);
        var nodeEvents = ((ctrl.eventNumbers.nodes/ctrl.totalEvents)*100 | 0) + (ctrl.eventNumbers.nodes ? 5 : 0);
        var otherEvents = 100 - (fileEvents + commentEvents + wikiEvents + nodeEvents);
        var div = ctrl.div;
        var begin = (Number(ctrl.firstDay.format('x'))/div | 0);
        var end = (Number(ctrl.today.format('x'))/div | 0);
        var values = [(Number(ctrl.dateBegin.format('x'))/div | 0), (Number(ctrl.dateEnd.format('x'))/div | 0)];
        var makeSliderProgress =  function(){
            return '<div id="fillerBar" class="progress" style="height: 11px">' +
                        '<div class="progress-bar"></div>' +
                '</div>';
        };
        var makeLine = function(canvas){
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            var progBar = $('#rAProgressBar');
            var handle = $('.ui-slider-handle');
            var leftHandle = handle[0];
            var rightHandle = handle[1];
            ctx.beginPath();
            ctx.moveTo(leftHandle.offsetLeft + (handle.width()/2), 0);
            ctx.lineTo(progBar.offset().left - $('#rACanvas').offset().left, ctrl.canvasHeight);
            ctx.strokeStyle = '#E0E0E0 ';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rightHandle.offsetLeft + (handle.width()/2), 0);
            ctx.lineTo(progBar.offset().left + progBar[0].offsetWidth - $('#rACanvas').offset().left, ctrl.canvasHeight);
            ctx.strokeStyle = '#E0E0E0 ';
            ctx.lineWidth = 2;
            ctx.stroke();
        };
        var addSlider = function(ele, isInitialized){
            var canvas = document.getElementById('rACanvas');
            if (!isInitialized) {
                $('#recentActivitySlider').slider({
                    min: begin,
                    max: end,
                    range: true,
                    values: values,
                    stop: function (event, ui) {
                        ctrl.page = 1;
                        ctrl.dateBegin = moment.utc(ui.values[0]*div);
                        ctrl.dateEnd = moment.utc(ui.values[1]*div);
                        ctrl.getLogs(false, true);
                    },
                    start: function (event, ui){
                        ctrl.loading = true;
                        m.redraw();
                        $('#fillerBar').replaceWith(
                            '<div id="fillerBar" class="progress" style="height: 11px">' +
                                '<div class="progress-bar progress-bar-success progress-bar-striped active" style="width:100%;"></div>' +
                            '</div>'
                        );
                    },
                    slide: function (){
                        makeLine(canvas);
                    }
                });
                $('#recentActivitySlider').slider('pips', {
                    last: false,
                    rest: 'label',
                    step: ctrl.steps,
                    formatLabel: function(value){
                        return String(moment.utc(value*div).format(ctrl.formatPip));
                    }
                }).slider('float', {
                    formatLabel: function(value){
                        return String(moment.utc(value*div).format(ctrl.formatFloat));
                    }
                });
                ctrl.getLogs();
                var bar = $('#recentActivitySlider').find('.ui-slider-range');
                bar.append(makeSliderProgress());
                makeLine(canvas);
            }
            else {
                $('#recentActivitySlider').slider('option', 'values', values);
                $('#fillerBar').replaceWith(makeSliderProgress());
                makeLine(canvas);
            }
        };
        var addButtons = function(ele, isInitialized) {
            if (isInitialized) {
                if ($('#leftButton')){
                    $('#leftButton').css('height', $('#logs').height());
                }
                if ($('#rightButton')){
                    $('#rightButton').css('height', $('#logs').height());
                }
            }
        };
        var categoryColor = function(category){
            if (category.indexOf('wiki') !== -1){ return '#d9534f'; }
            if (category.indexOf('comment') !== -1){ return '#5bc0de'; }
            if (category.indexOf('file') !== -1){ return '#337ab7'; }
            if (category.indexOf('project') !== -1){ return '#f0ad4e'; }
            else { return '#5cb85c'; }
        };
        var filterLabels = function(){
            if (!ctrl.eventFilter){
                if (otherEvents === 100) {
                    return m('p', 'No filters available');
                }
                return m('p', [
                    'Filter on: ',
                    fileEvents ? m('a', {onclick: function(){ctrl.callLogs('file')}}, 'Files' + (nodeEvents || commentEvents || wikiEvents ? ', ': '')): '',
                    nodeEvents ? m('a', {onclick: function(){ctrl.callLogs('project')}}, 'Projects' + (commentEvents || wikiEvents ? ', ': '')): '',
                    commentEvents ? m('a', {onclick: function(){ctrl.callLogs('comment')}}, 'Comments' + (wikiEvents ? ', ': '')): '',
                    wikiEvents ? m('a', {onclick: function(){ctrl.callLogs('wiki')}}, 'Wiki'): ''
                ]);
            } else {
                return m('p', [
                    m('span','Filtering on '),
                    m('b', (ctrl.eventFilter === 'file' ? 'Files' : ctrl.eventFilter === 'project' ? 'Projects' : ctrl.eventFilter === 'comment' ? 'Comments' : 'Wiki') + ' '),
                    m('span.badge.pointer.m-l-xs', {
                        onclick: function(){ ctrl.callLogs(ctrl.eventFilter); },
                    }, [ m('i.fa.fa-close'), ' Clear'])
                ]);
            }
        };
        return m('.fb-activity-list.col-md-8.col-md-offset-2.m-t-xl', [
                m('.time-slider-parent',
                    m('#recentActivitySlider',  {config: addSlider})
                ),
                m('canvas#rACanvas', {
                    style: {verticalAlign: 'middle'},
                    width: $('#recentActivitySlider').width(),
                    height: ctrl.canvasHeight
                }),
                m('.row', [
                    m('.col-xs-10.col-xs-offset-1',
                        m('#rAProgressBar.progress.category-bar',
                            ctrl.loading ? m('.progress-bar.progress-bar-success.active.progress-bar-striped', {style: {width: '100%'}}, m('b', {style:{color: 'white'}}, 'Loading')) : ([
                                m('a.progress-bar' + (ctrl.eventFilter === 'file' ||  ctrl.eventFilter === false ?  '.selected' : ''), {style: {width: fileEvents+'%'},
                                    onclick: function(){
                                        ctrl.callLogs('file');
                                    }}, m('i.fa.fa-file.progress-bar-button')
                                ),
                                m('a.progress-bar.progress-bar-warning' + (ctrl.eventFilter === 'project' ||  ctrl.eventFilter === false ?  '.selected' : ''), {style: {width: nodeEvents+'%'},
                                    onclick: function(){
                                        ctrl.callLogs('project');
                                    }},  m('i.fa.fa-cube.progress-bar-button')
                                ),
                                m('a.progress-bar.progress-bar-info' + (ctrl.eventFilter === 'comment' || ctrl.eventFilter === false ?  '.selected' : ''), {style: {width: commentEvents+'%'},
                                    onclick: function(){
                                        ctrl.callLogs('comment');
                                    }}, m('i.fa.fa-comment.progress-bar-button')
                                ),
                                m('a.progress-bar.progress-bar-danger' + (ctrl.eventFilter === 'wiki' || ctrl.eventFilter === false ?  '.selected' : ''), {style: {width: wikiEvents+'%'},
                                    onclick: function(){
                                        ctrl.callLogs('wiki');
                                    }}, m('i.fa.fa-book.progress-bar-button')
                                ),
                                (ctrl.totalEvents !== 0) ?
                                    m('.progress-bar.progress-bar-success', {style: {width: otherEvents+'%'}}, m('i.fa.fa-plus.progress-bar-button')) :
                                    m('.progress-bar.no-items-progress-bar', 'None')
                            ])
                        )
                    )
                ]),
                m('.row', !ctrl.loading ? [m('.col-xs-10.col-xs-offset-1', filterLabels())] : ''),
                 !ctrl.loading ?
                m('.row',{style:{paddingTop: '15px'}}, [
                    m('.col-xs-1', m('#leftButton' + (ctrl.page > 1 ? '' : '.disabled.hidden'), {
                        onclick: function(){
                            ctrl.page--;
                            ctrl.getLogs();
                        }},m('i.fa.fa-angle-left.page-button'))),
                    m('#logs.col-xs-10', {config: addButtons} ,(ctrl.activityLogs() && (ctrl.activityLogs().length > 0))? ctrl.activityLogs().map(function(item){
                        return m('.fb-activity-item.activity-item',
                            {style: {borderLeft: 'solid 5px ' + categoryColor(item.attributes.action)}}, [
                            m('span.text-muted.m-r-xs', item.attributes.formattableDate.local),
                            m.component(LogText,item)
                        ]);
                    }) : m('p','No activity in this time range.')),
                    m('.col-xs-1', m('#rightButton' + (ctrl.lastPage > ctrl.page ? '' : '.disabled.hidden'),{
                        onclick: function(){
                            ctrl.page++;
                            ctrl.getLogs();
                        }
                    }, m('i.fa.fa-angle-right.page-button' )))
                ]) : m('.spinner-loading-wrapper', [m('.logo-spin.logo-md'), m('p.m-t-sm.fg-load-message', 'Loading logs...')]),
                !ctrl.loading ? m('p.activity-pages.m-t-md.text-center', ctrl.page + ' of ' + ctrl.lastPage) : '',
            ]);
    }
};

module.exports = LogWrap;

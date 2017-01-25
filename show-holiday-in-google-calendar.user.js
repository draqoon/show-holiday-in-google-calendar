// ==UserScript==
// @name         show-holiday-in-google-calendar
// @namespace    https://calendar.google.com/calendar/render
// @version      1.0
// @description  Show Holiday in Google Calendar
// @author       Tatsuo Sanno
// @match        https://calendar.google.com/calendar/render*
// @grant        none
// ==/UserScript==

var GOOGLE_API_KEY = "AIzaSyAdy6qch4NDcOBTucUjfRd5GMniF-OaAJc";
console.log("google_api_key_calendar =", GOOGLE_API_KEY);
var CALENDAR_ID = 'japanese__ja@holiday.calendar.google.com';

function $$(selector){if(document.querySelectorAll) {
        var r = document.querySelectorAll(selector);
        if(r)
            return Array.apply(null, r);
    }
    return [];
}
function $(selector) {
    var r = /^#([^<>\.#\+]+)$/.exec(selector);
    if(r) {
        var id = r[1];
        return document.getElementById(id);
    }
    else if(document.querySelector) {
        return document.querySelector(selector);
    }
    return null;
}

(function() {
    'use strict';

    var HOLIDAY_FGCOLOR  = "red";

    var style = createElement("style", {"type":"text/css"}, ".saturday{background-color:lightcyan} .sunday{background-color:mistyrose} .holiday{background-color:mistyrose}");
    $("head").appendChild(style);

    function date2str(date) {
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var d = date.getDate();
        if( m < 10 ) m = "0" + m;
        if( d < 10 ) d = "0" + d;
        return y + "-" + m + "-" + d;
    }

    function CurrentMonth( text ) {
        //console.log("text = "+ text);
        var r = /([0-9]+)�N ?([0-9]+)��/.exec( text );
        this.year = parseInt(r[1]);
        this.month = parseInt(r[2]);
        this.prev = new Date(this.year, this.month - 2, 1); //�O���̏���
        this.next = new Date(this.year, this.month + 1, 0); //�����̖���
        this.key = text;
    }
    CurrentMonth.prototype = {
        createDate: function(text, isCurrentMonth) {
            var r = /([0-9]+)�� 1��/.exec( text );
            if( r ) {
                var m = parseInt(r[1]);
                if( !isCurrentMonth && m == 1 )
                    return new Date(this.year + 1, m - 1, 1);
                else
                    return new Date(this.year, m - 1, 1);
            }
            else {
                r = /([0-9]+)/.exec(text);
                if(r) {
                    var d = parseInt(r[1]);
                    if( isCurrentMonth ) {
                        //����
                        return new Date(this.year, this.month - 1, d);
                    }
                    else if( 15 < d ) {
                        //�O��
                        if( this.month === 1 )
                            return new Date(this.year - 1, 11, d);
                        else
                            return new Date(this.year, this.month - 2, d);
                    }
                    else {
                        //����
                        if( this.month === 12 )
                            return new Date(this.year + 1, 0, d);
                        else
                            return new Date(this.year, this.month, d);
                    }
                }
            }
            return null;
        }
    };

    //----------------------------------------------------------------
    // DOM���ω��������ɁA�j���`�揈�����s��
    //----------------------------------------------------------------
    var date_key;
    var observerOptions = {attributes:false, characterData:false, childList:true, subtree:true};
    var observer = new MutationObserver(function(data1,data2) {
        observer.disconnect();
        setTimeout(function(){
            date_key = $("#dp_0_cur").textContent;
            //console.log("date_key =", date_key);
            printWeekend();
            showHoliday(printHoliday);
            showHoliday(printHolidayMini);
            observer.observe($("body"), observerOptions);
        }, 10);
    });
    observer.observe($("body"), observerOptions);

    //----------------------------------------------------------------
    // Google Calendar API �𗘗p���āA�j�����X�g���擾
    //----------------------------------------------------------------
    var holidaysCache = {};
    function showHoliday(func) {
        if( !GOOGLE_API_KEY) return;

        var currentMonth = new CurrentMonth( date_key );
        //console.log("currentMonth =", currentMonth);

        // �j�����擾�ς̌��̓L���b�V������擾��A�j���`��
        // �J�����_�[�`�掞�ɕ�����DOM���X�V����邽�߁A�L���b�V�����Ȃ��Ɩ��ʂ�API�R�[������������
        if( currentMonth.key in holidaysCache ) {
            func(currentMonth);
            return;
        }

        //�j���̎擾���K�p
        var timeMin = date2str(currentMonth.prev) + 'T00:00:00+0900';
        var timeMax = date2str(currentMonth.next) + 'T23:59:59+0900';
        //console.log(timeMin, timeMax);
        // Google Calendar API V3��URL
        var apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/' +
            encodeURIComponent( CALENDAR_ID ) + '/events' +
            '?key=' + GOOGLE_API_KEY +
            '&timeMin=' + encodeURIComponent( timeMin ) +
            '&timeMax=' + encodeURIComponent( timeMax ) +
            '&fields=items(start,summary)';

        console.log("apiUrl=", apiUrl);
        fetch(apiUrl, { method:'GET' }).then(function(res){
            return res.json();
        }).then(function(holidays) {
            console.log("holidays=",holidays);
            //�P���Q���A�P���R���͏j���ɂȂ�Ȃ����߁A�����Ŗ������ǉ�����
            var y = 0;
            var jan = holidays.items.some(function(item){
                var d = new Date(item.start.date);
                if(d.getMonth() === 0){
                    y = d.getFullYear();
                    return true;
                }
                return false;
            });
            if(jan){
                //�P���Q���A�P���R�����U�֋x���ɂȂ��Ă���ꍇ�͎�菜��
                holidays.items = holidays.items.filter(function(item){
                    var d = new Date(item.start.date);
                    return !(d.getMonth() === 0 && (d.getDate() === 2 || d.getDate() === 3));
                });
                //�P���Q���A�P���R����ǉ�
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-02"},"summary":"�O����"}');
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-03"},"summary":"�O����"}');
            }

            //�擾�����j�����X�g���L���b�V���ɕۑ���A�j���`��
            holidaysCache[currentMonth.key] = holidays;
            func(currentMonth);
        });
    }

    //�y����`��
    function printWeekend() {
        //���C���J�����_�[
        // �\�����̔N��(yyyy�Nm��)
        var currentMonth = new CurrentMonth( date_key );

        $$("td.st-dtitle").some(function(td) {
            //���t�̎擾
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));

            //�g�̔w�i�F�̒��F
            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 || dayOfWeek === 6 ) {
                //�����牽��ڂ�
                var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                //�g�e�[�u���̃Z��������
                var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                var td_box = xpathresult.singleNodeValue;
                if( dayOfWeek === 0 ) { //���j��
                    td_box.classList.add("sunday");
                    td.classList.add("sunday");
                }
                else if( dayOfWeek === 6 ) { //�y�j��
                    td_box.classList.add("saturday");
                    td.classList.add("saturday");
                }
            }
        });

        //�~�j�J�����_�[
        // �\�����̔N��(yyyy�Nm��)
        var currentMonthMini = new CurrentMonth( $("#dp_0_cur").textContent );

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //���t�̎擾
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 ) { //���j��
                td.classList.add("sunday");
            }
            else if( dayOfWeek === 6 ) { //�y�j��
                td.classList.add("saturday");
            }
        });
    }

    //----------------------------------------------------------------
    // �j����`��
    //----------------------------------------------------------------
    function printHoliday(currentMonth) {
        // �\�����̔N��(yyyy�Nm��)
        var holidays = holidaysCache[currentMonth.key];

        //���C���J�����_�[
        $$("td.st-dtitle").some(function(td) {
            //���t�̎擾
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
            var ymdstr = date2str(ymd);

            if(0 < (td.querySelectorAll("span.holiday") || []).length) return false;

            //�j���̍s�̔w�i�F�ύX
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    //�j���̏ꍇ�́A�j������ݒ�
                    var span_holiday = createElement("span", {class:"holiday", style:{color:HOLIDAY_FGCOLOR, paddingLeft:"10px"}}, holiday.summary);
                    td.appendChild(span_holiday);

                    //�����牽��ڂ�
                    var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                    //�g�e�[�u���̃Z��������
                    var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                    var td_box = xpathresult.singleNodeValue;
                    td_box.classList.add("holiday");
                    td.classList.add("holiday");
                    return;
                }
            });
        });
    }
    function printHolidayMini(currentMonthMini) {
        // �\�����̔N��(yyyy�Nm��)
        var holidays = holidaysCache[currentMonthMini.key];

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //���t�̎擾
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            //�j���̍s�̔w�i�F�ύX
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    td.title = holiday.summary;
                    td.classList.add("holiday");
                    return;
                }
            });
        });
    }

    //�G�������g���쐬
    function createElement(tagName, attributes, textContent) {
        var element = document.createElement(tagName);
        for( var key in attributes ) {
            if( (attributes[key] instanceof Object) && !(attributes[key] instanceof Array) ) {
                element[key] = {};
                for( var key2 in attributes[key] )
                    element[key][key2] = attributes[key][key2];
            }
            else {
                element.setAttribute(key, attributes[key]);
            }
        }
        element.textContent = textContent;
        return element;
    }

    // ��ʃT�C�Y���擾
    function getScreenSize() {
        var h = 0;
        var w = 0;
        if ( window.innerHeight && window.innerWidth ) {
            h = window.innerHeight;
            w = window.innerWidth;
        }
        else if ( document.documentElement && document.documentElement.clientHeight !== 0 && document.documentElement.clientWidth !== 0 ) {
            h = document.documentElement.clientHeight;
            w = document.documentElement.clientWidth;
        }
        else if ( document.body ) {
            h = document.body.clientHeight;
            w = document.body.clientWidth;
        }
        return { height:h, width:w };
    }

})();

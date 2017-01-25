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
var CALENDAR_ID = 'japanese__ja@holiday.calendar.google.com';

function $$(selector){
    if(document.querySelectorAll) {
        var r = document.querySelectorAll(selector);
        if(r)
            return Array.apply(null, r);
    }
    return [];
}
function $(selector) {
    var r = /^#([^<>\.#\+ ]+)$/.exec(selector);
    if(r) return document.getElementById(r[1]);
    else if(document.querySelector) return document.querySelector(selector);
    else return null;
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
        var r = /([0-9]+)年 ?([0-9]+)月/.exec( text );
        this.year = parseInt(r[1]);
        this.month = parseInt(r[2]);
        this.prev = new Date(this.year, this.month - 2, 1); //前月の初日
        this.next = new Date(this.year, this.month + 1, 0); //翌月の末日
        this.key = text;
    }
    CurrentMonth.prototype = {
        createDate: function(text, isCurrentMonth) {
            var r = /([0-9]+)月 1日/.exec( text );
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
                        //当月
                        return new Date(this.year, this.month - 1, d);
                    }
                    else if( 15 < d ) {
                        //前月
                        if( this.month === 1 )
                            return new Date(this.year - 1, 11, d);
                        else
                            return new Date(this.year, this.month - 2, d);
                    }
                    else {
                        //次月
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
    // DOMが変化した時に、祝日描画処理を行う
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
    // Google Calendar API を利用して、祝日リストを取得
    //----------------------------------------------------------------
    var holidaysCache = {};
    function showHoliday(func) {
        if( !GOOGLE_API_KEY) return;

        var currentMonth = new CurrentMonth( date_key );
        //console.log("currentMonth =", currentMonth);

        // 祝日を取得済の月はキャッシュから取得後、祝日描画
        // カレンダー描画時に複数回DOMが更新されるため、キャッシュしないと無駄なAPIコールが発生する
        if( currentMonth.key in holidaysCache ) {
            func(currentMonth);
            return;
        }

        //祝日の取得＆適用
        var timeMin = date2str(currentMonth.prev) + 'T00:00:00+0900';
        var timeMax = date2str(currentMonth.next) + 'T23:59:59+0900';
        //console.log(timeMin, timeMax);
        // Google Calendar API V3のURL
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
            //１月２日、１月３日は祝日にならないため、ここで無理やり追加する
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
                //１月２日、１月３日が振替休日になっている場合は取り除く
                holidays.items = holidays.items.filter(function(item){
                    var d = new Date(item.start.date);
                    return !(d.getMonth() === 0 && (d.getDate() === 2 || d.getDate() === 3));
                });
                //１月２日、１月３日を追加
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-02"},"summary":"三が日"}');
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-03"},"summary":"三が日"}');
            }

            //取得した祝日リストをキャッシュに保存後、祝日描画
            holidaysCache[currentMonth.key] = holidays;
            func(currentMonth);
        });
    }

    //土日を描画
    function printWeekend() {
        //メインカレンダー
        // 表示中の年月(yyyy年m月)
        var currentMonth = new CurrentMonth( date_key );

        $$("td.st-dtitle").some(function(td) {
            //日付の取得
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));

            //枠の背景色の着色
            //abcdefgabc
            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 || dayOfWeek === 6 ) {
                //左から何列目か
                var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                //枠テーブルのセルを検索
                var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                var td_box = xpathresult.singleNodeValue;
                if( dayOfWeek === 0 ) { //日曜日
                    td_box.classList.add("sunday");
                    td.classList.add("sunday");
                }
                else if( dayOfWeek === 6 ) { //土曜日
                    td_box.classList.add("saturday");
                    td.classList.add("saturday");
                }
            }
        });

        //ミニカレンダー
        // 表示中の年月(yyyy年m月)
        var currentMonthMini = new CurrentMonth( $("#dp_0_cur").textContent );

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //日付の取得
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 ) { //日曜日
                td.classList.add("sunday");
            }
            else if( dayOfWeek === 6 ) { //土曜日
                td.classList.add("saturday");
            }
        });
    }

    //----------------------------------------------------------------
    // 祝日を描画
    //----------------------------------------------------------------
    function printHoliday(currentMonth) {
        // 表示中の年月(yyyy年m月)
        var holidays = holidaysCache[currentMonth.key];

        //メインカレンダー
        $$("td.st-dtitle").some(function(td) {
            //日付の取得
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
            var ymdstr = date2str(ymd);

            if(0 < (td.querySelectorAll("span.holiday") || []).length) return false;

            //祝日の行の背景色変更
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    //祝日の場合は、祝日名を設定
                    var span_holiday = createElement("span", {class:"holiday", style:{color:HOLIDAY_FGCOLOR, paddingLeft:"10px"}}, holiday.summary);
                    td.appendChild(span_holiday);

                    //左から何列目か
                    var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                    //枠テーブルのセルを検索
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
        // 表示中の年月(yyyy年m月)
        var holidays = holidaysCache[currentMonthMini.key];

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //日付の取得
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            //祝日の行の背景色変更
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    td.title = holiday.summary;
                    td.classList.add("holiday");
                    return;
                }
            });
        });
    }

    //エレメントを作成
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

    // 画面サイズを取得
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

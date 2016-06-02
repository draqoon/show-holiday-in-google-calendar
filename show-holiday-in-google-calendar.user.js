// ==UserScript==
// @name         show-holiday-in-google-calendar
// @namespace    https://calendar.google.com/calendar/render
// @version      0.1
// @description  Show Holiday in Google Calendar
// @author       Tatsuo Sanno
// @match        https://calendar.google.com/calendar/render*
// @grant        none
// ==/UserScript==

var GOOGLE_API_KEY = localStorage.getItem("google_api_key_calendar");
console.log("google_api_key_calendar =", GOOGLE_API_KEY);
var CALENDAR_ID = 'japanese__ja@holiday.calendar.google.com';

(function() {
    'use strict';

    var DEBUG = false;

    var HOLIDAY_FGCOLOR  = "red";
    var HOLIDAY_BGCOLOR  = "mistyrose";
    var SUNDAY_BGCOLOR   = "mistyrose";
    var SATURDAY_BGCOLOR = "lightcyan";

    function $$(selector) { return document.querySelectorAll(selector) || []; }
    function $(id) { return document.getElementById(id); }

    function date2str(date) {
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var d = date.getDate();
        if( m < 10 ) m = "0" + m;
        if( d < 10 ) d = "0" + d;
        return y + "-" + m + "-" + d;
    }

    function CurrentMonth( text ) {
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
    var _loading = false;
    document.addEventListener("DOMSubtreeModified", function(){
        if( _loading ) return;
        _loading = true;
        setTimeout(onDOMSubtreeModifiedAsync, 10);
    }, false);
    function onDOMSubtreeModifiedAsync() {
        showHoliday();
        addPreferenceButton();
        addDebugCheckbox();
        _loading = false;
    }

    //----------------------------------------------------------------
    // Google Calendar API を利用して、祝日リストを取得
    //----------------------------------------------------------------
    var currentMonth;
    var holidaysCache = {};
    function showHoliday() {
        // 表示中の年月(yyyy年m月)
        var key = $("dp_0_cur").textContent;

        // 祝日を取得済の月はキャッシュから取得後、祝日描画
        // カレンダー描画時に複数回DOMが更新されるため、キャッシュしないと無駄なAPIコールが発生する
        currentMonth = new CurrentMonth( key );
        if( key in holidaysCache ) {
            printHoliday();
            printHolidayMini();
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

        fetch(apiUrl, { method:'GET' }).then(function(res){
            return res.json();
        }).then(function(holidays) {
            //取得した祝日リストをキャッシュに保存後、祝日描画
            holidaysCache[currentMonth.key] = holidays;
            printHoliday();
        });
    }

    //----------------------------------------------------------------
    // 祝日と土日を描画
    //----------------------------------------------------------------
    function printHoliday() {
        var holidays = holidaysCache[currentMonth.key];

        Array.prototype.some.call($$("td.st-dtitle"), function(td) {
            //日付の取得
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
            var ymdstr = date2str(ymd);

            showDebugDate(td, span_day, ymdstr);

            if(0 < (td.querySelectorAll("span.holiday") || []).length) return false;

            //祝日の行の背景色変更
            var is_holiday = holidays.items.some(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    //祝日の場合は、祝日名を設定
                    var span_holiday = createElement("span", {className:"holiday", style:{color:HOLIDAY_FGCOLOR, paddingLeft:"10px"}}, holiday.summary);
                    td.appendChild(span_holiday);
                    return true;
                }
            });

            try {
                //枠の背景色の着色
                var dayOfWeek = ymd.getDay();
                if( is_holiday || dayOfWeek === 0 || dayOfWeek === 6 ) {
                    //左から何列目か
                    var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                    //枠テーブルのセルを検索
                    var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                    var td_box = xpathresult.singleNodeValue;
                    if( is_holiday ) { //祝日
                        td_box.style.backgroundColor = HOLIDAY_BGCOLOR;
                        td.style.backgroundColor = HOLIDAY_BGCOLOR;
                    }
                    else if( dayOfWeek === 0 ) { //日曜日
                        td_box.style.backgroundColor = SUNDAY_BGCOLOR;
                        td.style.backgroundColor = SUNDAY_BGCOLOR;
                    }
                    else if( dayOfWeek === 6 ) { //土曜日
                        td_box.style.backgroundColor = SATURDAY_BGCOLOR;
                        td.style.backgroundColor = SATURDAY_BGCOLOR;
                    }
                }
            }
            catch(ex){
                console.log(ex);
            }

        });
    }

    //----------------------------------------------------------------
    // 祝日と土日を描画(ミニカレンダー)
    //----------------------------------------------------------------
    function printHolidayMini() {
        var holidays = holidaysCache[currentMonth.key];

        Array.prototype.some.call($$("#dp_0_tbl td.dp-cell"), function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //日付の取得
            var ymd = currentMonth.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            //祝日の行の背景色変更
            var is_holiday = holidays.items.some(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    td.title = holiday.summary;
                    return true;
                }
                else {
                    return false;
                }
            });
            var dayOfWeek = ymd.getDay();
            if( is_holiday ) { //祝日
                td.style.backgroundColor = HOLIDAY_BGCOLOR;
            }
            else if( dayOfWeek === 0 ) { //日曜日
                td.style.backgroundColor = SUNDAY_BGCOLOR;
            }
            else if( dayOfWeek === 6 ) { //土曜日
                td.style.backgroundColor = SATURDAY_BGCOLOR;
            }
        });
    }

    function createElement(tagName, attributes, textContent) {
        var element = document.createElement(tagName);
        for( var key in attributes ) {
            if( (attributes[key] instanceof Object) && !(attributes[key] instanceof Array) ) {
                element[key] = {};
                for( var key2 in attributes[key] )
                    element[key][key2] = attributes[key][key2];
            }
            else {
                element[key] = attributes[key];
            }
        }
        element.textContent = textContent;
        return element;
    }

    function addDebugCheckbox() {
        var checkbox = document.getElementById('chkDebug');
        if( checkbox ) return;

        checkbox = createElement("input", {id:"chkDebug", type:"checkbox", style:{marginLeft:"10px"}, checked:DEBUG});
        checkbox.addEventListener("click", function(){
            DEBUG = !DEBUG;
            console.log("DEBUG =", DEBUG);
            //(デバッグ用)
            Array.prototype.some.call($$("td.st-dtitle"), function(td) {
                //日付の取得
                var span_day = td.querySelector("span");
                var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
                var ymdstr = date2str(ymd);
                showDebugDate(td, span_day, ymdstr);
            });
        });

        var parent = document.querySelector("div[id^='currentDate:']");
        parent.appendChild(checkbox);

        var label = createElement("label", {htmlFor:checkbox.id}, "デバッグ");
        parent.appendChild(label);
    }

    function addPreferenceButton() {
        var btn = document.getElementById('btnPref');
        if(btn)return;

        btn = createElement("input", { id:"btnPref", type:"button", style:{ marginLeft:"10px" }, value:"設定" });
        btn.addEventListener("click", function() {
            var box = document.getElementById("prefbox");
            if(box)return;

            var body = document.getElementsByTagName('body')[0];
            box = createElement("div", {id:"prefbox", style:{ position:"absolute", top:"100px", left:"100px", height:"90px", width:"450px", border:"1px solid black", backgroundColor:"white", padding:"15px" }});
            body.appendChild(box);

            var msg = createElement("div", {style:{marginBottom:"15px"}}, "Google API キーを設定してください。");
            box.appendChild(msg);

            var textbox = createElement("input", {id:"txtGoogleApiKey", type:"textbox", size:45, value:localStorage.getItem("google_api_key_calendar")});
            var label = createElement("label", {htmlFor:textbox.id}, "Google API キー");
            box.appendChild(label);
            box.appendChild(textbox);

            var btnbox = createElement("box", {id:"btnbox", style:{position:"absolute", right:"15px", bottom:"15px"}});
            box.appendChild(btnbox);

            var btnOK = createElement("input", {id:"btnOK", type:"button", value:"OK", style:{marginRight:"5px", width:"60px", height:"25px"}});
            btnOK.addEventListener("click", function() {
                localStorage.setItem("google_api_key_calendar", textbox.value);
                location.reload();
                body.removeChild(box);
            });
            btnbox.appendChild(btnOK);

            var btnCancel = createElement("input", {id:"btnCancel", type:"button", value:"Cancel", style:{width:"60px", height:"25px"}});
            btnCancel.addEventListener("click", function() {
                body.removeChild(box);
            });
            btnbox.appendChild(btnCancel);

            console.log("btnPref.click");
        });

        var parent = document.querySelector("div[id^='currentDate:']");
        parent.appendChild(btn);
    }

    function showDebugDate(td, span_day, ymdstr) {
        var span_dates = td.getElementsByClassName("holiday_debug") || [];
        if(0 < span_dates.length)
            td.removeChild(span_dates[0]);
        if( DEBUG ) {
            var span_date = createElement("span", {className:"holiday_debug"}, "(" + ymdstr + ")");
            td.insertBefore(span_date, span_day.nextSibling);
        }
    }
})();

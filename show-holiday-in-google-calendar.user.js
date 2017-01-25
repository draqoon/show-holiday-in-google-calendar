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
        var r = /([0-9]+)”N ?([0-9]+)ŒŽ/.exec( text );
        this.year = parseInt(r[1]);
        this.month = parseInt(r[2]);
        this.prev = new Date(this.year, this.month - 2, 1); //‘OŒŽ‚Ì‰“ú
        this.next = new Date(this.year, this.month + 1, 0); //—‚ŒŽ‚Ì––“ú
        this.key = text;
    }
    CurrentMonth.prototype = {
        createDate: function(text, isCurrentMonth) {
            var r = /([0-9]+)ŒŽ 1“ú/.exec( text );
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
                        //“–ŒŽ
                        return new Date(this.year, this.month - 1, d);
                    }
                    else if( 15 < d ) {
                        //‘OŒŽ
                        if( this.month === 1 )
                            return new Date(this.year - 1, 11, d);
                        else
                            return new Date(this.year, this.month - 2, d);
                    }
                    else {
                        //ŽŸŒŽ
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
    // DOM‚ª•Ï‰»‚µ‚½Žž‚ÉAj“ú•`‰æˆ—‚ðs‚¤
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
    // Google Calendar API ‚ð—˜—p‚µ‚ÄAj“úƒŠƒXƒg‚ðŽæ“¾
    //----------------------------------------------------------------
    var holidaysCache = {};
    function showHoliday(func) {
        if( !GOOGLE_API_KEY) return;

        var currentMonth = new CurrentMonth( date_key );
        //console.log("currentMonth =", currentMonth);

        // j“ú‚ðŽæ“¾Ï‚ÌŒŽ‚ÍƒLƒƒƒbƒVƒ…‚©‚çŽæ“¾ŒãAj“ú•`‰æ
        // ƒJƒŒƒ“ƒ_[•`‰æŽž‚É•¡”‰ñDOM‚ªXV‚³‚ê‚é‚½‚ßAƒLƒƒƒbƒVƒ…‚µ‚È‚¢‚Æ–³‘Ê‚ÈAPIƒR[ƒ‹‚ª”­¶‚·‚é
        if( currentMonth.key in holidaysCache ) {
            func(currentMonth);
            return;
        }

        //j“ú‚ÌŽæ“¾•“K—p
        var timeMin = date2str(currentMonth.prev) + 'T00:00:00+0900';
        var timeMax = date2str(currentMonth.next) + 'T23:59:59+0900';
        //console.log(timeMin, timeMax);
        // Google Calendar API V3‚ÌURL
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
            //‚PŒŽ‚Q“úA‚PŒŽ‚R“ú‚Íj“ú‚É‚È‚ç‚È‚¢‚½‚ßA‚±‚±‚Å–³—‚â‚è’Ç‰Á‚·‚é
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
                //‚PŒŽ‚Q“úA‚PŒŽ‚R“ú‚ªU‘Ö‹x“ú‚É‚È‚Á‚Ä‚¢‚éê‡‚ÍŽæ‚èœ‚­
                holidays.items = holidays.items.filter(function(item){
                    var d = new Date(item.start.date);
                    return !(d.getMonth() === 0 && (d.getDate() === 2 || d.getDate() === 3));
                });
                //‚PŒŽ‚Q“úA‚PŒŽ‚R“ú‚ð’Ç‰Á
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-02"},"summary":"ŽO‚ª“ú"}');
                holidays.items[holidays.items.length] = JSON.parse('{"start":{"date":"' + y + '-01-03"},"summary":"ŽO‚ª“ú"}');
            }

            //Žæ“¾‚µ‚½j“úƒŠƒXƒg‚ðƒLƒƒƒbƒVƒ…‚É•Û‘¶ŒãAj“ú•`‰æ
            holidaysCache[currentMonth.key] = holidays;
            func(currentMonth);
        });
    }

    //“y“ú‚ð•`‰æ
    function printWeekend() {
        //ƒƒCƒ“ƒJƒŒƒ“ƒ_[
        // •\Ž¦’†‚Ì”NŒŽ(yyyy”NmŒŽ)
        var currentMonth = new CurrentMonth( date_key );

        $$("td.st-dtitle").some(function(td) {
            //“ú•t‚ÌŽæ“¾
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));

            //˜g‚Ì”wŒiF‚Ì’…F
            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 || dayOfWeek === 6 ) {
                //¶‚©‚ç‰½—ñ–Ú‚©
                var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                //˜gƒe[ƒuƒ‹‚ÌƒZƒ‹‚ðŒŸõ
                var xpathresult = document.evaluate("../../../../table[@class='st-bg-table']/tbody/tr/td[" + (col_index + 1) + "]", td, null, XPathResult.FIRST_ORDERED_NODE_TYPE, xpathresult);
                var td_box = xpathresult.singleNodeValue;
                if( dayOfWeek === 0 ) { //“ú—j“ú
                    td_box.classList.add("sunday");
                    td.classList.add("sunday");
                }
                else if( dayOfWeek === 6 ) { //“y—j“ú
                    td_box.classList.add("saturday");
                    td.classList.add("saturday");
                }
            }
        });

        //ƒ~ƒjƒJƒŒƒ“ƒ_[
        // •\Ž¦’†‚Ì”NŒŽ(yyyy”NmŒŽ)
        var currentMonthMini = new CurrentMonth( $("#dp_0_cur").textContent );

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //“ú•t‚ÌŽæ“¾
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            var dayOfWeek = ymd.getDay();
            if( dayOfWeek === 0 ) { //“ú—j“ú
                td.classList.add("sunday");
            }
            else if( dayOfWeek === 6 ) { //“y—j“ú
                td.classList.add("saturday");
            }
        });
    }

    //----------------------------------------------------------------
    // j“ú‚ð•`‰æ
    //----------------------------------------------------------------
    function printHoliday(currentMonth) {
        // •\Ž¦’†‚Ì”NŒŽ(yyyy”NmŒŽ)
        var holidays = holidaysCache[currentMonth.key];

        //ƒƒCƒ“ƒJƒŒƒ“ƒ_[
        $$("td.st-dtitle").some(function(td) {
            //“ú•t‚ÌŽæ“¾
            var span_day = td.querySelector("span");
            var ymd = currentMonth.createDate(span_day.textContent, !td.classList.contains("st-dtitle-nonmonth"));
            var ymdstr = date2str(ymd);

            if(0 < (td.querySelectorAll("span.holiday") || []).length) return false;

            //j“ú‚Ìs‚Ì”wŒiF•ÏX
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    //j“ú‚Ìê‡‚ÍAj“ú–¼‚ðÝ’è
                    var span_holiday = createElement("span", {class:"holiday", style:{color:HOLIDAY_FGCOLOR, paddingLeft:"10px"}}, holiday.summary);
                    td.appendChild(span_holiday);

                    //¶‚©‚ç‰½—ñ–Ú‚©
                    var col_index = Array.prototype.indexOf.call(td.parentNode.childNodes, td);
                    //˜gƒe[ƒuƒ‹‚ÌƒZƒ‹‚ðŒŸõ
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
        // •\Ž¦’†‚Ì”NŒŽ(yyyy”NmŒŽ)
        var holidays = holidaysCache[currentMonthMini.key];

        $$("#dp_0_tbl td.dp-cell").some(function(td) {
            if( td.classList.contains("dp-dayh") ) return false;

            //“ú•t‚ÌŽæ“¾
            var ymd = currentMonthMini.createDate(td.textContent, !td.classList.contains("dp-offmonth") && !td.classList.contains("dp-offmonth-selected"));
            var ymdstr = date2str(ymd);

            //j“ú‚Ìs‚Ì”wŒiF•ÏX
            holidays.items.forEach(function(holiday) {
                if( holiday.start.date == ymdstr ) {
                    td.title = holiday.summary;
                    td.classList.add("holiday");
                    return;
                }
            });
        });
    }

    //ƒGƒŒƒƒ“ƒg‚ðì¬
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

    // ‰æ–ÊƒTƒCƒY‚ðŽæ“¾
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

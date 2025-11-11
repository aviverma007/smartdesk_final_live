import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin } from "lucide-react";

const HolidayCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

  // Holiday data from the PDF
  const holidays = [
    { id: 1, name: "New Year Day", date: "2025-01-01", day: "Wednesday", type: "National" },
    { id: 2, name: "Republic Day", date: "2025-01-26", day: "Sunday", type: "Weekend Holiday" },
    { id: 3, name: "Mahashiv Ratri", date: "2025-02-26", day: "Wednesday", type: "Religious" },
    { id: 4, name: "Holi", date: "2025-03-14", day: "Friday", type: "Religious" },
    { id: 5, name: "Raksha Bandhan", date: "2025-08-09", day: "Saturday", type: "Weekend Holiday" },
    { id: 6, name: "Independence Day", date: "2025-08-15", day: "Friday", type: "National" },
    { id: 7, name: "Janmashtami", date: "2025-08-16", day: "Saturday", type: "Religious" },
    { id: 8, name: "Maha Navmi", date: "2025-10-01", day: "Wednesday", type: "Religious" },
    { id: 9, name: "Gandhi Jayanti/Dussehra", date: "2025-10-02", day: "Thursday", type: "National" },
    { id: 10, name: "Diwali", date: "2025-10-21", day: "Tuesday", type: "Religious" },
    { id: 11, name: "Govardhan Puja", date: "2025-10-22", day: "Wednesday", type: "Religious" },
    { id: 12, name: "Bhai Dooj", date: "2025-10-23", day: "Thursday", type: "Religious" },
    { id: 13, name: "Christmas Day", date: "2025-12-25", day: "Thursday", type: "National" }
  ];

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get holidays for the current month
  const getHolidaysForMonth = (month, year) => {
    return holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === month && holidayDate.getFullYear() === year;
    });
  };

  // Check if a date is a holiday
  const isHoliday = (date, month, year) => {
    return holidays.some(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getDate() === date && 
             holidayDate.getMonth() === month && 
             holidayDate.getFullYear() === year;
    });
  };

  // Get holiday info for a specific date
  const getHolidayInfo = (date, month, year) => {
    return holidays.find(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getDate() === date && 
             holidayDate.getMonth() === month && 
             holidayDate.getFullYear() === year;
    });
  };

  // Generate calendar days
  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  // Navigate months
  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
    setSelectedDate(null);
  };

  const currentMonthHolidays = getHolidaysForMonth(currentMonth, currentYear);
  const calendarDays = generateCalendar();
  const today = new Date();

  const getHolidayTypeColor = (type) => {
    switch (type) {
      case "National":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "Religious":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Weekend Holiday":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-full">
      {/* Compact Header */}
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Holiday Calendar 2025</h1>
        </div>
        <p className="text-gray-600 text-sm">Company holidays and observances for the year</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Calendar - Further Reduced Size */}
        <div className="lg:col-span-3">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <CardTitle className="text-base font-bold">
                  {months[currentMonth]} {currentYear}
                </CardTitle>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="w-10 h-8 flex items-center justify-center text-xs font-semibold text-gray-600"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid - Fixed alignment */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const isCurrentDay = day && 
                    currentMonth === today.getMonth() && 
                    currentYear === today.getFullYear() && 
                    day === today.getDate();
                  
                  const holiday = day ? getHolidayInfo(day, currentMonth, currentYear) : null;
                  const isWeekend = index % 7 === 0 || index % 7 === 6; // Sunday or Saturday

                  return (
                    <div
                      key={index}
                      className={`
                        w-10 h-10 flex items-center justify-center relative cursor-pointer
                        transition-all duration-200 rounded text-sm font-medium
                        ${!day ? 'invisible' : ''}
                        ${isCurrentDay ? 'bg-blue-600 text-white shadow-md' : ''}
                        ${holiday ? 'bg-gradient-to-br from-sky-100 to-indigo-100 text-gray-800 shadow-sm' : ''}
                        ${!holiday && !isCurrentDay ? 'hover:bg-gray-100' : ''}
                        ${isWeekend && !holiday && !isCurrentDay ? 'text-gray-500' : ''}
                        ${selectedDate === day ? 'ring-2 ring-blue-400' : ''}
                      `}
                      onClick={() => day && setSelectedDate(day)}
                    >
                      {day}
                      {holiday && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-700 rounded-full border border-white"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Holiday Details - More Compact */}
        <div className="lg:col-span-2 space-y-3">
          {/* Selected Date Details */}
          {selectedDate && (
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-1">
                <CardTitle className="text-xs flex items-center space-x-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{months[currentMonth]} {selectedDate}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {(() => {
                  const holiday = getHolidayInfo(selectedDate, currentMonth, currentYear);
                  if (holiday) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-700 rounded-full"></div>
                          <span className="font-semibold text-gray-800 text-xs">{holiday.name}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">{holiday.day}</span>
                        </div>
                        <Badge className={`${getHolidayTypeColor(holiday.type)} border text-xs`}>
                          {holiday.type}
                        </Badge>
                      </div>
                    );
                  } else {
                    return (
                      <p className="text-gray-500 text-center py-1 text-xs">No holiday</p>
                    );
                  }
                })()}
              </CardContent>
            </Card>
          )}

          {/* Monthly Holidays List - Very Compact */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-600 text-white py-1">
              <CardTitle className="text-xs">
                {months[currentMonth]} ({currentMonthHolidays.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {currentMonthHolidays.length > 0 ? (
                <div className="space-y-1">
                  {currentMonthHolidays.slice(0, 3).map((holiday) => {
                    const holidayDate = new Date(holiday.date);
                    return (
                      <div
                        key={holiday.id}
                        className="bg-gradient-to-r from-gray-50 to-blue-50 p-1 rounded border-l-2 border-blue-500 hover:shadow-sm transition-shadow cursor-pointer"
                        onClick={() => setSelectedDate(holidayDate.getDate())}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-gray-800 text-xs">{holiday.name.length > 15 ? holiday.name.substring(0, 15) + '...' : holiday.name}</h4>
                          <span className="text-xs text-gray-500">{holidayDate.getDate()}</span>
                        </div>
                      </div>
                    );
                  })}
                  {currentMonthHolidays.length > 3 && (
                    <div className="text-center text-xs text-gray-500 py-1">
                      +{currentMonthHolidays.length - 3} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-gray-500">
                  <Calendar className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No holidays</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Holiday Stats - Very Compact */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-600 text-white py-1">
              <CardTitle className="text-xs">Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              <div className="flex items-center justify-between p-1 bg-orange-50 rounded">
                <span className="text-sky-800 font-medium text-xs">National</span>
                <Badge className="bg-sky-200 text-sky-800 text-xs">
                  {holidays.filter(h => h.type === "National").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-1 bg-purple-50 rounded">
                <span className="text-indigo-800 font-medium text-xs">Religious</span>
                <Badge className="bg-indigo-200 text-indigo-800 text-xs">
                  {holidays.filter(h => h.type === "Religious").length}
                </Badge>
              </div>
              <div className="border-t pt-1 mt-1">
                <div className="flex items-center justify-between p-1 bg-gray-50 rounded">
                  <span className="text-gray-800 font-bold text-xs">Total</span>
                  <Badge className="bg-gray-200 text-gray-800 font-bold text-xs">
                    {holidays.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full Holiday List for 2025 */}
          <Card className="shadow-lg border-0 bg-blue-50">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-1">
              <CardTitle className="text-xs">All Holidays 2025</CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-60 overflow-y-auto">
              <div className="space-y-1">
                {holidays.map((holiday) => {
                  const holidayDate = new Date(holiday.date);
                  return (
                    <div
                      key={holiday.id}
                      className="bg-white p-2 rounded border-l-3 border-blue-500 hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => {
                        setCurrentMonth(holidayDate.getMonth());
                        setCurrentYear(holidayDate.getFullYear());
                        setSelectedDate(holidayDate.getDate());
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-800 text-xs">{holiday.name}</h4>
                        <Badge className={`${getHolidayTypeColor(holiday.type)} border text-xs px-1 py-0`}>
                          {holiday.type}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <span className="text-xs">{holidayDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}</span>
                        <span className="text-xs">({holiday.day})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Compact Note */}
      <Card className="mt-4 border-l-4 border-yellow-500 bg-yellow-50">
        <CardContent className="p-3">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> Roaster system to be followed for Sales, CRM and site teams as approved by respective HOD's. 
            Weekend holidays are observed on the actual dates but may not result in additional leave days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayCalendar;
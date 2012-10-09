import cgi
import wsgiref.handlers
import os
import urllib
import string
import simplejson as json
import logging

from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import webapp
from google.appengine.ext import db

class MonthlyEntry(db.Model):
    userid = db.StringProperty()
    name = db.StringProperty()
    default_amount = db.FloatProperty()
    type = db.StringProperty()
    
    def toDict(self):
        return {'name': self.name, 'type': self.type, 'amount': self.default_amount, 'id': self.name}

class OneTimeEntry(db.Model):
    userid = db.StringProperty()
    name = db.StringProperty()
    year = db.IntegerProperty()
    month = db.StringProperty()
    amount = db.FloatProperty()
    type = db.StringProperty()
    
    def toDict(self):
        return {'name': self.name, 'type': self.type, 'amount': self.amount, 'year': self.year, 'month': self.month, 'id': (str(self.year) + ":" + self.month + ":" + self.name)}

class Month(db.Model):
    month = db.StringProperty()
    year = db.IntegerProperty()
    userid = db.StringProperty()
    start_balance = db.FloatProperty()
    
    def toDict(self):
        return {'start_balance': self.start_balance, 'id': (str(self.year) + ":" + self.month)};

def getMonthlyEntriesByUserId(userid):
    monthly = db.GqlQuery("SELECT * FROM MonthlyEntry WHERE userid = :1", userid)
    entries = []
    for m in monthly:
        entries.append(m.toDict())
    return entries

def getOneTimeEntriesByUserId(userid):
    one_time = db.GqlQuery("SELECT * FROM OneTimeEntry WHERE userid = :1", userid)
    entries = []
    for e in one_time:
        entries.append(e.toDict())
    return entries

def getMonthsByUserId(userid):
    months = db.GqlQuery("SELECT * FROM Month WHERE userid = :1", userid)
    entries = []
    for m in months:
        entries.append(m.toDict())
    return entries

def monthly_key_name(userid, name):
    return userid + ":" + name

def one_time_key_name(userid, name, year, month):
    return userid + ":" + name + ":" + year + ":" + month

def month_key_name(userid, year, month):
    return userid + ":" + year + ":" + month

def addEntity(cur_user, name, amount, type, monthly, year, month):
        if not cur_user:
            return False

        userid = cur_user.user_id();
        if monthly:
            #Adding a MonthlyEntry
            #If there is already a OneTimeEntry with the same name, then cancel the add.
            if OneTimeEntry.all().filter('userid =', userid).filter('name =', name).get():
                return False
            already_entered = MonthlyEntry.get_by_key_name(monthly_key_name(userid, name))
            if already_entered:
                if already_entered.default_amount != amount:
                    already_entered.default_amount = amount
                    already_entered.put()
            else:
                monthly_entry = MonthlyEntry(key_name=monthly_key_name(userid, name))
                monthly_entry.userid = userid
                monthly_entry.name = name
                monthly_entry.default_amount = amount
                monthly_entry.type = type
                monthly_entry.put()
        else:
            already_entered = OneTimeEntry.get_by_key_name(one_time_key_name(userid, name, year, month))
            if already_entered:
                if already_entered.amount != amount:
                    already_entered.amount = amount
                    already_entered.put()
            else:
                one_time_entry = OneTimeEntry(key_name=one_time_key_name(userid, name, year, month))
                one_time_entry.userid = userid
                one_time_entry.name = name
                one_time_entry.year = int(year)
                one_time_entry.month = month
                one_time_entry.type = type
                one_time_entry.amount = amount
                one_time_entry.put()
        return True

class Login(webapp.RequestHandler):
    def get(self):
        username = users.get_current_user()
        if users.get_current_user():
            url = users.create_logout_url(self.request.uri)
            url_linktext = 'Logout'
            message_pretext = 'You are logged in as <b>%s</b>.' % (username)
            message_posttext = ''
        else:
            url = users.create_login_url(self.request.uri)
            url_linktext = 'Login'
            message_pretext = 'Please '
            message_posttext = ' to view content.'

        template_values = {
            'url': url,
            'username': username,
            'url_linktext': url_linktext,
            'message_pretext': message_pretext,
            'message_posttext': message_posttext,
            }
        path = os.path.join(os.path.dirname(__file__), 'templates/main.html')
        self.response.out.write(template.render(path, template_values))

    def post(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        
        name = self.request.get("name")
        amount = float(self.request.get("amount"))

        monthly = self.request.get("monthly")
        monthly = True if (monthly == "True") else False

        type = self.request.get("type");

        year = None
        month = None       
        
        if not monthly:
            year = self.request.get("year")
            month = self.request.get("month")

        ret = addEntity(users.get_current_user(), name, amount, type, monthly, year, month)
        self.response.out.write(ret);

class Entries(webapp.RequestHandler):        
    def get(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        
        dic = {}
        dic["monthly"] = getMonthlyEntriesByUserId(user.user_id())
        dic["one_time"] = getOneTimeEntriesByUserId(user.user_id())
        dic["months"] = getMonthsByUserId(user.user_id())
        
        js = json.dumps(dic)
        
        self.response.headers.add_header('content-type', 'applications/json', charset='utf-8')
        self.response.out.write(js)
    
class UpdateMonth(webapp.RequestHandler):
    def post(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.");
            return
        userid = user.user_id()
        
        month = self.request.get("month");
        year = self.request.get("year");
        start_balance = self.request.get("start_balance");

        existing_month = Month.get_by_key_name(month_key_name(userid, year, month))
        if existing_month:
            existing_month.start_balance = float(start_balance)
            existing_month.put()
        else:
            m = Month(key_name=month_key_name(userid, year, month))
            m.userid = user.user_id()
            m.month = month
            m.year = int(year)
            m.start_balance = float(start_balance)
            m.put()

application = webapp.WSGIApplication([
    ('/', Login),
    ('/Entries', Entries),
    ('/UpdateMonth', UpdateMonth)
], debug=True)

def main():
    logging.getLogger().setLevel(logging.DEBUG)
    run_wsgi_app(application)

if __name__ == '__main__':
    main()

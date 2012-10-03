import cgi
import wsgiref.handlers
import os
import urllib
import string
import simplejson as json

from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import webapp
from google.appengine.ext import db

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

class MonthlyEntry(db.Model):
    userid = db.StringProperty()
    name = db.StringProperty()
    default_amount = db.FloatProperty()
    
    def toDict(self):
        return {'name': self.name, 'default_amount': self.default_amount}
    
class ModifiedMonthlyEntry(db.Model):
    year = db.IntegerProperty()
    month = db.StringProperty()
    amount = db.FloatProperty()
    
    def toDict(self):
        return {'year': self.year, 'month': self.month, 'name': db.get(self.parent).name}

class OneTimeEntry(db.Model):
    userid = db.StringProperty()
    name = db.StringProperty()
    year = db.IntegerProperty()
    month = db.StringProperty()
    amount = db.FloatProperty()
    
    def toDict(self):
        return {'name': self.name, 'amount': self.amount, 'year': self.year, 'month': self.month}

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

def getModifiedMonthlyEntriesByUserId(userid):
    modified = db.GqlQuery("SELECT * FROM ModifiedMonthlyEntry WHERE userid = :1", userid)
    entries = []
    for e in modified:
        entries.append(e.toDict())
    return entries
        
class Month(db.Model):
    starting_balance = db.FloatProperty()
    lastmonth_difference = db.FloatProperty()

def monthly_key_name(userid, name):
    return userid + ":" + name

def one_time_key_name(userid, name, year, month):
    return userid + ":" + name + ":" + year + ":" + month

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
        name = self.request.get("input_name")
        amount = float(self.request.get("input_amount"))
        monthly = self.request.get("monthly")
        monthly = True if (monthly == "True") else False
        year = None
        month = None       
        
        if not monthly:
            year = self.request.get("year")
            month = self.request.get("month")

        ret = self.addEntity(name, amount, monthly, year, month)
        self.response.out.write("Success");

    def addEntity(self, name, amount, monthly, year, month):
        user = users.get_current_user()
        if not user:
            return False

        if monthly:
            #Adding a MonthlyEntry
            #If there is already a OneTimeEntry with the same name, then cancel the add.
            if OneTimeEntry.all().filter('userid =', user.user_id()).filter('name =', name).get():
                return False
            already_entered = MonthlyEntry.get_by_key_name(monthly_key_name(user.user_id(), name))
            if already_entered:
                if already_entered.default_amount != amount:
                    already_entered.default_amount = amount
                    already_entered.put()
            else:
                monthly_entry = MonthlyEntry(key_name=monthly_key_name(user.user_id(), name))
                monthly_entry.userid = user.user_id()
                monthly_entry.name = name
                monthly_entry.default_amount = amount
                monthly_entry.put()
        else:
            #Adding a OneTimeEntry
            #If there is already a MonthlyEntry with the same name, then cancel the add
            if MonthlyEntry.all().filter('userid =', user.user_id()).filter('name =', name).get():
                return False
            already_entered = OneTimeEntry.get_by_key_name(one_time_key_name(user.user_id(), name, year, month))
            if already_entered:
                if already_entered.amount != amount:
                    already_entered.amount = amount
                    already_entered.put()
            else:
                one_time_entry = OneTimeEntry(key_name=one_time_key_name(user.user_id(), name, year, month))
                one_time_entry.userid = user.user_id()
                one_time_entry.name = name
                one_time_entry.year = int(year)
                one_time_entry.month = month
                one_time_entry.amount = amount
                one_time_entry.put()
        return True

class Transactions(webapp.RequestHandler):        
    def post(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        
        monthly = getMonthlyEntriesByUserId(user.user_id())
        one_time = getOneTimeEntriesByUserId(user.user_id())
        modified = getModifiedMonthlyEntriesByUserId(user.user_id())
        
        dic = {}
        dic["monthly"] = monthly
        dic["one_time"] = one_time
        dic["modified"] = modified
        
        js = json.dumps(dic)
        
        self.response.headers.add_header('content-type', 'applications/json', charset='utf-8')
        self.response.out.write(js)
    
application = webapp.WSGIApplication([
    ('/', Login),
    ('/Transactions', Transaction)
], debug=True)

def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()

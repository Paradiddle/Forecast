import cgi
import wsgiref.handlers
import os
import urllib
import string

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
    modification_keys = db.StringListProperty()
    amount_modifications = db.ListProperty(float)
        
class OneTimeEntry(db.Model):
    userid = db.StringProperty()
    name = db.StringProperty()
    year = db.IntegerProperty()
    month = db.StringProperty()
    amount = db.FloatProperty()
    
class Month(db.Model):
    starting_balance = db.FloatProperty()
    lastmonth_difference = db.FloatProperty()

def getName(expense):
    return expense.name

def getOneTimeAmount(expense):
    return expense.amount

def getMonthlyAmount(expense):
    return expense.default_amount

def modification_key(year, month):
    return year + ":" + month

def monthly_key_name(userid, name):
    return str(userid) + ":" + name

def one_time_key_name(userid, name, year, month):
    return userid + ":" + name + ":" + year + ":" + month

def expenseNameExistsInList(lst, expense):
    if not lst:
        return False
    for e in lst:
        if e.name == expense.name:
            return True
    return False

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
            'data': self.getDataScreen()
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
        self.response.out.write(self.getDataScreen())

    def addEntity(self, name, amount, monthly, year, month):
        user = users.get_current_user()
        if not user:
            return False

        if monthly: #Adding a MonthlyEntry
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
        else:       #Adding a OneTimeEntry
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
    
    def getDataScreen(self):
        user = users.get_current_user()
        if not user:
            return
        headers = ['Name', 'Amount']
        column_functions = [getName, getMonthlyAmount]
        monthly = db.GqlQuery("SELECT * FROM MonthlyEntry WHERE userid = :1", user.user_id())
        
        row_data = []
        for m in monthly:
            col_data = []
            col_data.append(m.name)
            col_data.append(m.default_amount)
            row_data.append(col_data)
            
        template_values = {
            'headers': headers,
            'row_data': row_data,
        }
        path = os.path.join(os.path.dirname(__file__), 'templates/month.html')
        return template.render(path, template_values)
    
class Transaction(webapp.RequestHandler):        
    def post(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        str = ""
        year = self.request.get("year")
        for m in MONTHS:
            str += self.getTableForYearMonth(year, m, user.user_id())
        self.response.out.write(str)   
    
    def getTableForYearMonth(self, year, month, userid):
        monthly = db.GqlQuery("SELECT * FROM MonthlyEntry WHERE userid = :1", userid)
        one_time = db.GqlQuery("SELECT * FROM OneTimeEntry WHERE userid = :1 AND year = :2 AND month = :3", userid, int(year), month)
        headers = ['Name', 'Amount']
        
        row_data = []
        for m in monthly:
            col_data = []
            col_data.append(m.name)
            col_data.append(m.default_amount)
            row_data.append(col_data)
            
        for o in one_time:
            col_data = []
            col_data.append(o.name)
            col_data.append(o.amount)
            row_data.append(col_data)

        template_values = {
            'headers': headers,
            'row_data': row_data,
            'month': month,
            'year': year
        }
        path = os.path.join(os.path.dirname(__file__), 'templates/month.html')
        return template.render(path, template_values)
        
application = webapp.WSGIApplication([
    ('/', Login),
    ('/Transactions', Transaction)
], debug=True)

def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()

import cgi
import wsgiref.handlers
import os
import urllib
import string
import json
import logging

from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app
import webapp2 as webapp
from google.appengine.ext import db

class JsonProperty(db.TextProperty):
    def validate(self, value):
        return value
    
    def get_value_for_datastore(self, model_instance):
        result = super(JsonProperty, self).get_value_for_datastore(model_instance)
        result = json.dumps(result)
        return db.Text(result)
    
    def make_value_from_datastore(self, value):
        try:
            value = json.loads(str(value))
        except:
            pass
        
        return super(JsonProperty, self).make_value_from_datastore(value)

class User(db.Model):
    userid = db.StringProperty()
    num_monthly = db.IntegerProperty(default=0)
    num_one_time = db.IntegerProperty(default=0)
    obj = JsonProperty()
    
class Login(webapp.RequestHandler):
    def get(self):
        username = users.get_current_user()
        if users.get_current_user():
            url = users.create_logout_url(self.request.uri)
            url_linktext = 'Logout'
            message_pretext = 'You are logged in as \'%s\'.' % (username)
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

class Entries(webapp.RequestHandler):        
    def get(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        
        already_entered = User.get_by_key_name(user.user_id())
        self.response.headers.add_header('content-type', 'applications/json', charset='utf-8')
        if already_entered:
            self.response.out.write(json.dumps(already_entered.obj))
        else:
            self.response.out.write(json.dumps("{'monthly': {}, 'one_time': {}, 'months': {}}"))
            
    def post(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        data = json.loads(self.request.body)
        
        num_one_time = 0
        for v in data['one_time']:
            num_one_time += 1
        num_monthly = 0
        for v in data['monthly']:
            num_monthly += 1
        
        u = User.get_by_key_name(user.user_id())
        if not u:
            u = User(key_name=user.user_id())
            u.userid = user.user_id()
            u.obj = data
            self.response.out.write("Save file successfully created.");
        else:
            u.obj = data
            self.response.out.write("Save file successfully updated.");
            diff_one_time = num_one_time - u.num_one_time
            diff_monthly = num_monthly - u.num_monthly
            if diff_one_time >= 0:
                self.response.out.write("\n%d one time entries added." % diff_one_time)
            else:
                self.response.out.write("\n%d one time entries removed.") % abs(diff_one_time)
            if diff_monthly >= 0:
                self.response.out.write("\n%d monthly entries added" % diff_monthly)
                
        u.num_monthly = num_monthly
        u.num_one_time = num_one_time
        u.put()
            

application = webapp.WSGIApplication([
    ('/', Login),
    ('/Entries', Entries)
], debug=True)

def main():
    logging.getLogger().setLevel(logging.DEBUG)
    run_wsgi_app(application)

if __name__ == '__main__':
    main()

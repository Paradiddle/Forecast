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
    email = db.StringProperty()
    sharing_with = db.StringListProperty(default=[])
    num_monthly = db.IntegerProperty(default=0)
    num_one_time = db.IntegerProperty(default=0)
    settings = JsonProperty()
    months = JsonProperty()
    one_time = JsonProperty()
    monthly = JsonProperty()
    modifications = JsonProperty()
    
class Login(webapp.RequestHandler):
    def get(self):
        username = users.get_current_user()
        if users.get_current_user():
            url = users.create_logout_url(self.request.uri)
            url_linktext = 'Logout'
            message_pretext = 'Welcome, %s!' % (username)
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

class Share(webapp.RequestHandler):       
    def post(self):
        user = users.get_current_user()
        
        if not user:
            self.response.out.write('Invalid user.')
            return
        
        to_add = str(self.request.get('add'))
        to_remove = str(self.request.get('remove'))

        usr = User.get_by_key_name(user.user_id())
        if usr:
            if to_add:
                if to_add not in usr.sharing_with:
                    usr.sharing_with.append(to_add)
                    usr.put()
            if to_remove:
                if to_remove in usr.sharing_with:
                    usr.sharing_with.remove(to_remove)
                    usr.put()
                
        self.response.headers.add_header('content-type', 'applications/json', charset='utf-8')
        
        obj = {};
        obj['sharing_with'] = usr.sharing_with        
        obj['shared'] = getSharedWith(user)
        
        self.response.out.write(json.dumps(obj))
        
def getSharedWith(user):
    lst = []
    sharing = db.GqlQuery("SELECT email FROM User WHERE sharing_with = :1", user.email())
    for i in sharing:
        lst.append(i.email)
    return lst

def getData(entity, user):
    obj = {}
    obj['monthly'] = entity.monthly
    obj['one_time'] = entity.one_time
    obj['months'] = entity.months
    obj['modifications'] = entity.modifications
    obj['settings'] = entity.settings
    if entity.userid == user.user_id():
        obj['sharing_with'] = entity.sharing_with
    else:
        obj['sharing_with'] = []
    obj['shared'] = getSharedWith(user)
    return obj

class Entries(webapp.RequestHandler):        
    def get(self):
        user = users.get_current_user()
        if not user:
            self.response.out.write("Invalid user.")
            return
        
        self.response.headers.add_header('content-type', 'applications/json', charset='utf-8')
        
        mask = self.request.get('viewing')
        if mask:
            viewing_other = db.GqlQuery("SELECT * FROM User WHERE email = :1", mask)
            other = User.get_by_key_name(viewing_other[0].userid)
            if other:
                obj = getData(other, user)
                obj['viewing_other'] = mask
                self.response.out.write(json.dumps(obj))
                return
        
        already_entered = User.get_by_key_name(user.user_id())
        
        
        if already_entered:
            self.response.out.write(json.dumps(getData(already_entered, user)))
        else:
            obj = User(key_name=user.user_id())
            obj.userid = user.user_id()
            obj.email = user.email()
            obj.monthly = []
            obj.one_time = []
            obj.months = []
            obj.sharing_with = []
            obj.modifications = []
            obj.settings = {}
            obj.put()
            self.response.out.write(json.dumps(getData(obj, user)))
            
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
            u.email = user.email()
            u.userid = user.user_id()
           
        u.months = data['months']
        u.monthly = data['monthly']
        u.modifications = data['modifications']
        u.one_time = data['one_time']
        u.sharing_with = data['sharing_with']
        u.settings = data['settings']
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
    ('/Entries', Entries),
    ('/Share', Share)
], debug=True)

def main():
    logging.getLogger().setLevel(logging.DEBUG)
    run_wsgi_app(application)

if __name__ == '__main__':
    main()

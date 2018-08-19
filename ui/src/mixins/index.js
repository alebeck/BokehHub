/*
* BokehHub
* Author: Alexander Becker
* (c) 2018
*/

var deauthenticate = {
  methods: {
    deauthenticate: function () {
        this.$store.commit('deauthenticate');
        this.$router.push('/login');
        console.log('Deauthenticated.');
    }
  }
}

var getStatus = {
  methods: {
    getStatus: function (row) {
        switch(row.status) {
            case 'ready':
                return {'positive': 'true', 'title': 'Ready'};

            case 'pending':
                return {'intermediary': 'true', 'pulse': 'true', 'title': 'In progress'};

            case 'error':
                return {
                  'negative': 'true', 
                    'title': row.errmsg ? 'Error: ' + row.errmsg : 'Error'
                };

            default:
                return {'negative': 'true'};
        }
    }
  }
}

var getCursor = {
  methods: {
    getCursor(status) {
        switch(status) {
            case 'pending':
                return 'not-allowed';

            default:
                return 'pointer';
        }
    }
  }
}

export { deauthenticate, getStatus, getCursor };
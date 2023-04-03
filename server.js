const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { json } = require('express');

const env = require('dotenv').config();

const app = express();
app.use(cors())

var headers;
const githubToken = process.env.API_KEY;

// Optional Github Token Authorization
if(githubToken) {
    headers = {
        headers: {
            'Authorization': `Bearer ${githubToken}`
        }
    }
}

app.get('/', (req, res) => {
    const json = {
        title: "Express GithubAPI",
        description: "RestAPI using Express that makes calls to GitHubAPI_v3 to fetch relevant data",
        date: '31/03/2023',
        creator: {
            name: "Jordi Sevilla Marí",
            github: "github.com/JordiSM",
            linkedin: "https://www.linkedin.com/in/jordi-sevilla-mari-a7a076243/"
        },
        routes: [
            {
                route: "/orgs",
                description: "Returns total of public organizations on Github and Lists all organizations, in the order that they were created on GitHub.",
                params: [
                    {
                        param: "per_page",
                        type: "integer",
                        description: "Indicates the number of results per page",
                        default: 30,
                        max: 100
                    },
                    {
                        param: "page",
                        type: "integer",
                        description: "Page number of the results to fetch",
                        default: 1,
                    }
                ]
            },
            {
                route:"/orgs/{name}",
                description: "Returns the total amount of public Repositorys in an Organization and list all the public data",
                example: "/orgs/trifork"

            },
            {
                route:"/orgs/{name}/repos",
                description: "List first 30 public repositories of an Organization",
                example: "/orgs/trifork/repos"

            },
            {
                route:"/orgs/{name}/repos/biggest",
                description: "Returns the biggest public repository (in bytes) of an Organization",
                example: "/orgs/trifork/repos/biggest"
            }
        ]
    }
    res.send(json)

});

// Returns total of public organizations on Github and Lists all organizations, in the order that they were created on GitHub
app.get('/orgs', async (req, res) => {

    const page = req.query.page || 1;          //Default value 1
    const per_Page = req.query.per_page || 30; //Default value 30

    url = `https://api.github.com/search/users?q=type:org+public&page=${page}&per_page=${per_Page}`

    axios.get(url, headers)
    .then( (response) => {
        //Map all the organizations and get the information we want
        orgs = response.data.items.map(org => (
        { 
            login: org.login,
            id: org.id,
            org_route: "/orgs/" + org.login 
        }));
        
        //add the organizations in the Array and create JSON response
        const json = { 
            TotalCount: response.data.total_count,
            page: page,
            per_Page: per_Page,
            orgs: orgs 
        };
    
        res.status(200).json(json);
    })
    .catch((error) =>{
        console.error(error)

        if(error.status = 503){ //Github Service unavailable
            jsonError = {
                status: 503,
                code: error.code,
                description: "GithubAPI route ' https://api.github.com/search/users' unavailable"
            }
        } else{  // Other error
            jsonError = {
                status: error.status,
                code: error.code
            }
        }
        res.status(error.status).json(jsonError);
    });
});

// Returns the total amount of public Repositorys in an Organization and list all the public data
app.get('/orgs/:name', (req, res) => {
    
    url = `https://api.github.com/orgs/${req.params['name']}`

    axios.get(url, headers)
    .then((response) => {        

        const json = { 
            name: response.data.login,
            total_repositorys: response.data.public_repos,
            
            data: response.data
        };
    
        res.status(200).json(json);
    })
    .catch((error) => {
        if(error.status == 404){
            jsonError = {
                status: 404,
                code: error.code,
                description: `Organization '${req.params['name']}' not found.`
            }
        } else {
            // We should only get Status 200 and status 404 from HTTP
            // https://docs.github.com/es/rest/orgs/orgs?apiVersion=2022-11-28#get-an-organization--status-codes
            jsonError = {
                status: error.status,
                code: error.codes
            }
            console.error(error);
        }
        res.status(error.status).json(jsonError);
    })
});

// List first 30 public repositories of an Organization
app.get('/orgs/:name/repos', (req, res) => {
    
    url = `https://api.github.com/orgs/${req.params['name']}/repos`;
    
    axios.get(url, headers)
    .then(response => {

        //from each repository, we only get the relevant information
        repositories = response.data.map(repo => (
        { 
            id: repo.id,
            name: repo.name,
            description: repo.description,
            size: repo.size,
        }));

        const json = {
            organization: req.params['name'],
            repositories: repositories
        };

        res.status(200).json(json);
    })
    .catch(error => {
        if(error.status == 404){
            jsonError = {
                status: 404,
                code: error.code,
                description: `Organization '${req.params['name']}' not found.`
            }
        } else {
            // We should only get Status 200 and status 404 from HTTP
            // https://docs.github.com/es/rest/orgs/orgs?apiVersion=2022-11-28#get-an-organization--status-codes
            jsonError = {
                status: error.status,
                code: error.codes
            }
            console.error(error);
        }
        res.status(error.status).json(jsonError);
    })
});

// Returns the biggest public repository (in bytes) of an Organization
app.get('/orgs/:name/repos/biggest', async (req, res) => {

    url = `https://api.github.com/orgs/${req.params['name']}/repos?page=1&per_page=100`;
    
    max_size = 0;
    max_repo = {}

    // Max of repositorys at once is 100. If the organization has maro than 100 we will need to
    // make multiple API fetchs until all repositories have been analyzed
    while(url) {
        const response = await axios.get(url, headers)
    
        //Organizatio not found
        if(response.status == 404){
            jsonError = {
                status: 404,
                code: response.code,
                description: `Organization '${req.params['name']}' not found.`
            }
            res.status(404).json(jsonError);
            return;
        }

        // Other error
        if(response.status != 200){
            // We should only get Status 200 and status 404 from HTTP
            // https://docs.github.com/es/rest/orgs/orgs?apiVersion=2022-11-28#get-an-organization--status-codes
            jsonError = {
                status: response.status,
                code: response.code
            }
            console.error(error);
            res.status(500).json(jsonError)
            return;
        }
        


        // Get the biggest repository
        response.data.map((repo) => {
            if(repo.size > max_size){
                max_repo = {
                    id: repo.id,
                    name: repo.name,
                    size: repo.size
                }
                max_size = repo.size;
            }
        })

        // Analize the header to get the next url (next page of repositories)
        url = null
        link = response.headers.get('Link')
        
        indxEnd = link.indexOf('rel="next"');

        //if found the next link, then we substring the link from the header and the loop continues
        if(indxEnd != -1){
            indxStart = link.slice(0, indxEnd).lastIndexOf('<');
            url = link.substring(indxStart + 1, indxEnd - 3)
        }

        //if not found, loop ends
    }
    res.status(200).json(max_repo);
});


/*
First Version of getting the total amount of repositorys on Github
 - "Not optim": Cost O(k * n/100 ) => O(n) ; 
    Being n total amount of organizations aprox 5500

 app.get('/v0/orgs', async (req, res) => {

    url = 'https://api.github.com/organizations?type=public&per_page=100'
    let orgs = []

    while(url){
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${githubToken}`
            }
        })
    
        if(response.status != 200){
            res.status(response.status).send("Error from calling GithubAPI");
            return
        }

        //Map all the organizations and get the information we need
        newOrgs = response.data.map(org => (
        { 
            login: org.login,
            id: org.id,
            repoRoute: "/orgs/" + org.login 
        }));
        
        //add the new organizations in the Array
        orgs = [...orgs, ...newOrgs];

        //inspect the header and get the next url
        url = null;

        link = response.headers.get('Link');
        indxEnd = link.indexOf('rel="next"');

        if(indxEnd != -1){
            indxStart = link.slice(0, indxEnd).lastIndexOf('<');
            url = link.substring(indxStart + 1, indxEnd - 3)
            console.log(url)
        }
    }

    const json = { 
        total: orgs.length,
        orgs: orgs 
    };

    res.status(200).json(json);
});
*/


// ***********************| Running on Port 3000 |***********************
app.listen(3000, () => {
    console.log('Server Express running on port 3000');
});
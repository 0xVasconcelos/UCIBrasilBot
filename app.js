'use strict';

var rp = require('request-promise');
var _ = require('lodash');

var Conteudo = [];

var cinemaAPI = cinemaAPI || {};

cinemaAPI.cinemas = 'http://m.ucicinemas.com.br/json/Cinemas.php';
cinemaAPI.cinema = 'http://m.ucicinemas.com.br/json/Cinema.php?idCinema=';
cinemaAPI.filme = 'http://m.ucicinemas.com.br/json/filme.php?idFilme=';

class Cinema {
  constructor(obj) {
    this.id = obj.id;
    this.name = obj.nome;
    this.address = obj.endereco;
    this.movies = [];
  }
  addMovie(obj) {
    this.movies.push(new Movie(obj));
  }
}

class Movie {
  constructor(obj) {
    this.id = obj.id;
    this.name = obj.nome;
    this.img = obj.URLimagem;
    this.sessions = [];
  }
  addTime(obj) {
    this.sessions.push(new Sessions(obj))
  }
  addInfo(obj) {
    var descricao = obj.descricao.split("\n");
    var age = /([0-9]\w+)/.exec(descricao[1].split(" - ")[1]);
    this.genre = descricao[1].split(" - ")[0];
    this.age = (age ? age[0] : "Livre");
    this.duration = /([0-9]\w+)/.exec(descricao[1].split(" - ")[2])[0];
    this.synopsis = obj.sinopse;
    this.idYoutube = obj.idYoutube;
    this.director = /Direção: (.+)/.exec(descricao[2])[1];
    this.actors = descricao[3].replace("Com:", "").replace("...", "").split("; ");
  }
}

class Sessions {
  constructor(obj) {
    this.room = obj.sala;
    this.time = obj.hora;
  }
}


rp(cinemaAPI.cinemas)
  .then(function(data) {
    data = JSON.parse(data).cinemas;
    for (var i in data)
      Conteudo.push(new Cinema(data[i]))
  })
  .then(function() {
    for (var i in Conteudo) {
      rp(cinemaAPI.cinema + Conteudo[i].id)
        .then(function(cine) {
          cine = JSON.parse(cine).cinema[0];
          var filmes = cine.filmes;
          for (var j in filmes) {
            var curCine = _.find(Conteudo, function(o) {
              return o.id === cine.id
            });
            curCine.addMovie(filmes[j]);
            setMovieInfo(filmes[j].id, cine.id, j)
            for (var k in filmes[j].horarios) {
              curCine.movies[j].addTime(filmes[j].horarios[k])
            }
          }
        })
        .catch(function(err) {
          console.log("Alguma merda rolou")
        })
    }
  })


function setMovieInfo(id, cineid, i) {
  rp(cinemaAPI.filme + id)
    .then(function(body) {
      var cinema = _.find(Conteudo, function(o) {
        return o.id == cineid;
      })
      var movie = _.find(cinema.movies, function(o) {
        return o.id === id
      })
      movie.addInfo(JSON.parse(body).filme[0])
    })
    .catch(function(err) {
      console.log("AA")
    })
}


setInterval(function() {
  console.log(Conteudo[0].movies)
}, 5000)

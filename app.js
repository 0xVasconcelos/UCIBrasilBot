'use strict';

var rp = require('request-promise');
var TelegramBot = require('node-telegram-bot-api');
var _ = require('lodash');
var botan = require('botanio')(process.argv[3]);

//nova instância do bot
var bot = new TelegramBot(process.argv[2], {
  polling: true
});

var Conteudo = [];
var cinemaAPI = {};
var userSessions = {};

cinemaAPI.pollingInterval = "500000"; // definir tempo para atualizar o cartaz

//endpoints da API do UCI
cinemaAPI.cinemas = 'http://m.ucicinemas.com.br/json/Cinemas.php';
cinemaAPI.cinema = 'http://m.ucicinemas.com.br/json/Cinema.php?idCinema=';
cinemaAPI.filme = 'http://m.ucicinemas.com.br/json/filme.php?idFilme=';

// classes
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

var parseAPI = function() {
  rp(cinemaAPI.cinemas)
    .then(function(data) {
      Conteudo = [];
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
          .catch(function(err) {})
      }
    })
}

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
    .catch(function(err) {})
}

parseAPI();
setInterval(parseAPI, cinemaAPI.pollingInterval);

bot.onText(/\/ajuda/, function(msg, match) {
  var text = "Bem-vindo ao bot do UCI, comigo você poderá saber o que está em cartaz hoje nos cinemas UCI mais próximo de você ;) \nComandos: \n/cinemas\n\nQualquer dúvida ou sugestão, entrar em contato com @vasconcelos";
  bot.sendMessage(msg.chat.id, text);
  botan.track(msg, 'help');
});

bot.onText(/\/help/, function(msg, match) {
  var text = "Bem-vindo ao bot do UCI, comigo você poderá saber o que está em cartaz hoje nos cinemas UCI mais próximo de você ;) \nComandos: \n/cinemas\n\nQualquer dúvida ou sugestão, entrar em contato com @vasconcelos";
  bot.sendMessage(msg.chat.id, text);
  botan.track(msg, 'help');
});

bot.onText(/\/start/, function(msg, match) {
  var text = "Bem-vindo ao bot do UCI, comigo você poderá saber o que está em cartaz hoje nos cinemas UCI mais próximo de você ;) \nComandos: \n/cinemas\n\nQualquer dúvida ou sugestão, entrar em contato com @vasconcelos";
  bot.sendMessage(msg.chat.id, text);
  botan.track(msg, 'start');
});

bot.onText(/\/cinemas/, function(msg, match) {
  bot.sendChatAction(msg.chat.id, "typing")
  var cinemas = [];
  for (var i in Conteudo) {
    cinemas.push([Conteudo[i].name]);
  }
  var opt = {
    reply_to_message_id: msg.message_id,
    reply_markup: JSON.stringify({
      keyboard: cinemas,
      one_time_keyboard: true,
      selective: true,
      hide_keyboard: true
    })
  }
  bot.sendMessage(msg.chat.id, "Escolha o cinema mais próximo de você :)", opt);
  botan.track(msg, 'cinemas');
});

bot.onText(/(UCI.+)/, function(msg, match) {
  var cinema = _.find(Conteudo, function(o) {
    return o.name === match[0]
  });
  if (cinema) {
    var filmes = [];
    for (var i in cinema.movies) {
      filmes.push([cinema.movies[i].name])
    }
    filmes.push(["/cinemas"])
    var opt = {
      reply_to_message_id: msg.message_id,
      reply_markup: JSON.stringify({
        keyboard: filmes,
        one_time_keyboard: true,
        selective: true,
        hide_keyboard: true
      })
    }
    userSessions[msg.chat.id] = {
      cinema: match[0]
    };
    bot.sendMessage(msg.chat.id, "Escolha o filme que deseja assistir :)", opt);
  } else {
    bot.sendMessage(msg.chat.id, "Escolha novamente o cinema que deseja assistir usando /cinemas :)");
  }
  botan.track(msg, match[0]);
})

bot.onText(/^(?!UCI|SINOPSE|ATORES|TRAILER|ATORES)(.+)/, function(msg, match) {
  var cinema = _.find(Conteudo, function(o) {
    return o.name === userSessions[msg.chat.id].cinema
  });
  if (cinema) {
    var filme = _.find(cinema.movies, function(o) {
      return o.name === match[0]
    });
    if (filme) {
      var text = `Nome: ${filme.name}\n`;
      text += `Genêro: ${filme.genre}\n`;
      text += `Classificação: ${filme.age} anos\n`;
      text += `Duração: ${filme.duration} min\n`
      text += `Sessões:\n`
      for (var i in filme.sessions) {
        text += ` ${filme.sessions[i].room}:\n`;
        for (var j in filme.sessions[i].time) {
          text += `  ${filme.sessions[i].time[j]}\n`
        }
      }
      var opt = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
          keyboard: [
            ['SINOPSE'],
            ['TRAILER'],
            ['DIRETORES'],
            ['ATORES'],
            ['/cinemas']
          ],
          one_time_keyboard: true,
          selective: true,
          hide_keyboard: true
        })
      }
      bot.sendMessage(msg.chat.id, text);
      userSessions[msg.chat.id] = {
        cinema: userSessions[msg.chat.id].cinema,
        movie: match[0]
      };
      bot.sendMessage(msg.chat.id, "Escolha o que mais deseja saber sobre o filme :)", opt);
    } else {
      bot.sendMessage(msg.chat.id, "Escolha novamente o cinema que deseja assistir usando /cinemas :)");
    }
  } else {
    bot.sendMessage(msg.chat.id, "Escolha novamente o cinema que deseja assistir usando /cinemas :)");
  }
  botan.track(msg, match[0]);
})

bot.onText(/(SINOPSE|TRAILER|DIRETOR|ATORES)/, function(msg, match) {
  var cinema = _.find(Conteudo, function(o) {
    return o.name === userSessions[msg.chat.id].cinema
  });
  if (cinema) {
    var filme = _.find(cinema.movies, function(o) {
      return o.name === userSessions[msg.chat.id].movie
    });
    if (filme) {
      var text = "";
      switch (match[0]) {
        case 'SINOPSE':
          text = filme.synopsis;
          break;
        case 'TRAILER':
          text = `http://youtu.be/${filme.idYoutube}`;
          break;
        case 'DIRETOR':
          text = filme.director;
          break;
        case 'ATORES':
          for (var i in filme.actors)
            text += `${filme.actors[i]}\n`
          break;
      }
      bot.sendMessage(msg.chat.id, text);
    } else {
      bot.sendMessage(msg.chat.id, "Escolha novamente o cinema que deseja assistir usando /cinemas :)");
    }
  } else {
    bot.sendMessage(msg.chat.id, "Escolha novamente o cinema que deseja assistir usando /cinemas :)");
  }
  botan.track(msg, match[0]);
})

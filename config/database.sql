CREATE DB babble;
USE babble;

CREATE TABLE `users` (
  `id` bigint(32) NOT NULL,
  `accessToken` varchar(255) NOT NULL,
  `name` varchar(250) NOT NULL,
  `birthday` date NOT NULL,
  `location` varchar(250) NOT NULL,
  `gender` varchar(6) NOT NULL,
  `picture` varchar(250) NOT NULL,
  `description` varchar(140) NOT NULL,
  `likeMen` tinyint(1) NOT NULL DEFAULT '0',
  `likeWomen` tinyint(1) NOT NULL DEFAULT '1',
  `searchRadius` smallint(5) NOT NULL DEFAULT '50',
  `latitude` float NOT NULL,
  `longitude` float NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `latitude` (`latitude`,`longitude`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `userLinksFinished` (
  `userId1` bigint(32) NOT NULL,
  `userId2` bigint(32) NOT NULL,
  `action` smallint(1) NOT NULL,
  KEY `userId1` (`userId1`),
  KEY `userId2` (`userId2`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `userLinksPending` (
  `userIdLiked` bigint(32) NOT NULL,
  `userIdPending` bigint(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
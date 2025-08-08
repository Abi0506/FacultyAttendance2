-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: localhost    Database: faculty_data_logs
-- ------------------------------------------------------
-- Server version	9.0.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `exemptions`
--

DROP TABLE IF EXISTS `exemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exemptions` (
  `exemptionId` int NOT NULL AUTO_INCREMENT,
  `exemptionType` varchar(50) NOT NULL,
  `staffId` varchar(20) NOT NULL,
  `exemptionStaffName` varchar(100) DEFAULT NULL,
  `exemptionSession` varchar(50) DEFAULT NULL,
  `exemptionDate` date DEFAULT NULL,
  `exemptionReason` varchar(255) DEFAULT NULL,
  `otherReason` varchar(255) DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `exemptionStatus` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`exemptionId`),
  KEY `staffId` (`staffId`),
  CONSTRAINT `exemptions_ibfk_1` FOREIGN KEY (`staffId`) REFERENCES `staff` (`staff_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exemptions`
--

LOCK TABLES `exemptions` WRITE;
/*!40000 ALTER TABLE `exemptions` DISABLE KEYS */;
INSERT INTO `exemptions` VALUES (27,'Session','I0215','Mahavishnu','1,5,2,6','2025-06-20','official',NULL,NULL,NULL,'approved'),(28,'Session','I0215','Mahavishnu','1,2','2025-06-21','Other','Sample',NULL,NULL,'approved'),(29,'Session','I0215','Mahavishnu','7,2,6','2025-06-23','Personal',NULL,NULL,NULL,'approved'),(30,'Day','I0215','Mahavishnu',NULL,'2025-06-23','Family',NULL,NULL,NULL,'approved'),(31,'Time','I0215','Mahavishnu',NULL,'2025-07-11','Medical',NULL,'09:20:00','11:22:00','approved'),(32,'Day','I0216','HR',NULL,'2025-07-11','Medical',NULL,NULL,NULL,'approved');
/*!40000 ALTER TABLE `exemptions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-11 11:03:10

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
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `staff_id` varchar(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `dept` varchar(20) DEFAULT NULL,
  `category` int DEFAULT NULL,
  `password` varchar(60) DEFAULT NULL,
  `designation` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`staff_id`),
  KEY `category` (`category`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`category`) REFERENCES `category` (`category_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
INSERT INTO `staff` VALUES ('715524104021','Arya A','CSE',1,'$2b$10$dhZ1FHqTviZtx9mVGmuau.IbY67TG6dUkqEFQC4REwWXvkiy.Nkdu','STAFF'),('I01001','Wanda Maximoff','ECE',1,'$2b$10$8JpoILSCkshxdtEmveU5X.YoMaacwdTdIZ4e6BKGYodn0OZxxCGRK','Professor'),('I0215','Mahavishnu','CSE',1,'$2b$10$vqI/V7zF7v1EM8ES8mP7Ne01TM/polzcC2JVIllMubXyVlepBfNzG','STAFF'),('I0216','HR','MECH',1,'$2b$10$ym84uMh1v2ZBIPEPaU01Oulx3z5Kjoy/frSKPCVwsQRayuvbdSKdy','HR'),('I0217','Tony','ECE',1,NULL,'STAFF'),('I0218','Stephen','CSE',2,'$2b$10$81ruD1IC6jTBQN5Ruv6JzOm9BEqCjsUoKxeEf5BtI9xyh9.UEAq.a','STAFF');
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-11 11:03:09

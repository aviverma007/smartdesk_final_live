-- SmartDesk: biometric device -> site mapping
-- Run in SSMS against etimetracklite1AI (192.168.66.33) if the attendance
-- backend can't create the table itself (its login lacks CREATE TABLE rights).
-- Safe to run more than once: existing rows are updated, missing ones inserted.
USE etimetracklite1AI;
GO
IF OBJECT_ID('dbo.SD_DeviceLocations','U') IS NULL
CREATE TABLE dbo.SD_DeviceLocations (
  DeviceId  INT           NOT NULL PRIMARY KEY,
  SiteName  NVARCHAR(120) NOT NULL,
  IsActive  BIT           NOT NULL DEFAULT(1),
  UpdatedAt DATETIME      NOT NULL DEFAULT(GETDATE())
);
GO
MERGE dbo.SD_DeviceLocations AS t
USING (VALUES
  (19, N'IFC 14th Floor'),
  (20, N'IFC 11th Floor'),
  (21, N'Smart 75'),
  (22, N'Smart 69'),
  (23, N'Smart 66'),
  (24, N'Smart 61'),
  (25, N'Smart 62'),
  (26, N'Smart 89'),
  (27, N'Smart 113'),
  (28, N'Noida 126'),
  (29, N'Noida 98'),
  (30, N'IFC 12th Floor'),
  (31, N'Smart 61 Phase 2'),
  (32, N'Smart GIC Manesar')
) AS s (DeviceId, SiteName)
ON t.DeviceId = s.DeviceId
WHEN MATCHED THEN UPDATE SET SiteName = s.SiteName, IsActive = 1, UpdatedAt = GETDATE()
WHEN NOT MATCHED THEN INSERT (DeviceId, SiteName) VALUES (s.DeviceId, s.SiteName);
GO
-- If the backend uses a different login, let it read the table:
-- GRANT SELECT ON dbo.SD_DeviceLocations TO smartdesk_user;
SELECT * FROM dbo.SD_DeviceLocations ORDER BY DeviceId;

package ru.staffly.inventory;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class DishwareInventoryMigrationTest {
    @Test void upgradeBackfillsStableKeysAndCascadesSaveReceipts() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:dishware-migration;MODE=PostgreSQL")) {
            var sql = db.createStatement();
            sql.execute("create table dishware_inventory(id bigint primary key)");
            sql.execute("create table dishware_inventory_item(id bigint primary key, inventory_id bigint)");
            sql.execute("insert into dishware_inventory values(1)");
            sql.execute("insert into dishware_inventory_item values(10,1), (11,1)");
            ScriptUtils.executeSqlScript(db, new ClassPathResource("db/migration/V137__dishware_inventory_concurrency.sql"));
            var result = sql.executeQuery("select version from dishware_inventory where id=1"); result.next(); assertEquals(0, result.getLong(1));
            result = sql.executeQuery("select client_key from dishware_inventory_item where id=10"); result.next(); assertEquals("item-10", result.getString(1));
            assertThrows(java.sql.SQLException.class, () -> sql.execute("insert into dishware_inventory_item(id,inventory_id,client_key) values(12,1,'item-10')"));
            sql.execute("insert into dishware_inventory_save_receipt(inventory_id, request_id, payload_hash, applied_version) values(1, random_uuid(), 'hash', 1)");
            ScriptUtils.executeSqlScript(db, new ClassPathResource("db/migration/V138__dishware_history_and_surplus.sql"));
            result = sql.executeQuery("select include_surplus from dishware_inventory where id=1"); result.next(); assertFalse(result.getBoolean(1));
            sql.execute("insert into dishware_inventory_history(inventory_id, restaurant_id, actor_id, actor_name, action, occurred_at) values(1,1,1,'Manager','UPDATED',current_timestamp)");
            sql.execute("delete from dishware_inventory where id=1");
            result = sql.executeQuery("select count(*) from dishware_inventory_save_receipt"); result.next(); assertEquals(0, result.getInt(1));
            result = sql.executeQuery("select count(*) from dishware_inventory_history"); result.next(); assertEquals(1, result.getInt(1));
        }
    }
}

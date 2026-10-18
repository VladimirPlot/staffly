package ru.staffly.inventory;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import ru.staffly.inventory.dto.UpsertDishwareInventoryItemRequest;

import static org.junit.jupiter.api.Assertions.*;

class DishwareInventoryValidationTest {
    @Test
    void noteAcceptsFiveThousandCharactersAndRejectsOverflow() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            for (int length : new int[] { 2001, 5000 }) {
                var request = new UpsertDishwareInventoryItemRequest(null, "Тарелка", 10, 0, 8, null, 0, "я".repeat(length));
                assertTrue(validator.validate(request).isEmpty());
            }
            var request = new UpsertDishwareInventoryItemRequest(null, "Тарелка", 10, 0, 8, null, 0, "я".repeat(5001));
            assertTrue(validator.validate(request).stream().anyMatch(v -> v.getPropertyPath().toString().equals("note")));
        }
    }
}

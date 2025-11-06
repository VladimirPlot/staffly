package ru.staffly.schedule.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Converter
public class PositionIdsConverter implements AttributeConverter<List<Long>, String> {

    @Override
    public String convertToDatabaseColumn(List<Long> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        return attribute.stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    @Override
    public List<Long> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return Collections.emptyList();
        }
        String[] parts = dbData.split(",");
        List<Long> result = new ArrayList<>(parts.length);
        for (String part : parts) {
            try {
                result.add(Long.parseLong(part.trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        return result;
    }
}
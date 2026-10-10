package ru.staffly.announcement.dto;

import java.util.List;

public record AnnouncementPageDto(List<AnnouncementDto> items, int page, int size, long totalElements,
                                  int totalPages, String timezone) {}
